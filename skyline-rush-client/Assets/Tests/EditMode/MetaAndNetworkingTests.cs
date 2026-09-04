using System.Collections.Generic;
using System.Threading.Tasks;
using NUnit.Framework;
using SkylineRush.Meta;
using SkylineRush.Networking;

namespace SkylineRush.Tests
{
    /// <summary>
    /// Records every request handed to it and replays a queued (or default) canned response,
    /// so SkylineRushApiService / controller tests can run without a real network stack.
    /// </summary>
    public class FakeHttpTransport : IHttpTransport
    {
        public List<string> RequestedMethods { get; } = new List<string>();
        public List<string> RequestedUrls { get; } = new List<string>();
        public List<Dictionary<string, string>> RequestedHeaders { get; } = new List<Dictionary<string, string>>();

        public HttpResponse DefaultResponse { get; set; } = new HttpResponse { StatusCode = 200, BodyJson = "{}" };
        private readonly Queue<HttpResponse> _queuedResponses = new Queue<HttpResponse>();

        public int CallCount => RequestedMethods.Count;

        public void EnqueueResponse(HttpResponse response) => _queuedResponses.Enqueue(response);

        public Task<HttpResponse> SendAsync(string method, string url, string bodyJson, Dictionary<string, string> headers)
        {
            RequestedMethods.Add(method);
            RequestedUrls.Add(url);
            RequestedHeaders.Add(headers);

            HttpResponse response = _queuedResponses.Count > 0 ? _queuedResponses.Dequeue() : DefaultResponse;
            return Task.FromResult(response);
        }
    }

    [TestFixture]
    public class MetaAndNetworkingTests
    {
        private static SkylineRushApiService MakeService(out FakeHttpTransport transport)
        {
            transport = new FakeHttpTransport();
            var apiClient = new ApiClient(transport, "https://api.test.local");
            return new SkylineRushApiService(apiClient);
        }

        // ----------------------------------------------------------------------------------
        // Parental gate: must never fabricate or validate the answer client-side — every
        // accept/reject decision must come straight from the server response.
        // ----------------------------------------------------------------------------------

        [Test]
        public async Task Test_ParentalGate_DefersEntirelyToServer_OnAccept()
        {
            var api = MakeService(out var transport);

            // Server hands out a challenge whose "real" answer is unknowable to the client.
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"challenge_id\":\"c1\",\"question\":\"What is 4 + 9?\",\"challenge_token\":\"tok_abc\"}"
            });
            // Server accepts whatever the player typed (even though it is not actually 13),
            // proving the client performs zero arithmetic validation of its own.
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"parental_gate_token\":\"pgt_xyz\",\"expires_in_seconds\":300}"
            });

            var gate = new ParentalGateController(api);
            await gate.OpenAsync();
            Assert.AreEqual("tok_abc", gate.ChallengeToken, "Challenge token must be relayed verbatim from the server");

            gate.AppendDigit('9');
            gate.AppendDigit('9');
            gate.AppendDigit('9'); // deliberately "wrong" — the client cannot know this
            bool success = await gate.SubmitAsync();

            Assert.IsTrue(success, "Client must accept whatever the server decides, not its own arithmetic");
            Assert.AreEqual("pgt_xyz", gate.LastVerifiedGateToken, "Gate token must come from the server response");
            Assert.IsFalse(gate.IsVisible, "Modal should close on server-verified success");
        }

        [Test]
        public async Task Test_ParentalGate_DefersEntirelyToServer_OnReject()
        {
            var api = MakeService(out var transport);
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"challenge_id\":\"c1\",\"question\":\"What is 2 + 2?\",\"challenge_token\":\"tok_abc\"}"
            });
            // Server rejects even a numerically-correct-looking answer — the client must obey.
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 403,
                BodyJson = "{\"error\":{\"code\":\"INCORRECT_ANSWER\",\"message\":\"Incorrect\"}}"
            });

            var gate = new ParentalGateController(api);
            await gate.OpenAsync();
            gate.AppendDigit('4');
            bool success = await gate.SubmitAsync();

            Assert.IsFalse(success, "A server rejection must fail the flow regardless of client-side guesses");
            Assert.IsNull(gate.LastVerifiedGateToken, "No gate token should ever be minted client-side");
            Assert.AreEqual("", gate.InputDigits, "Input should be cleared after a rejected attempt");
        }

        [Test]
        public async Task Test_ParentalGate_RejectsNonNumericInput_WithoutContactingServer()
        {
            var api = MakeService(out var transport);
            var gate = new ParentalGateController(api);
            // No digits appended -> InputDigits is empty, which cannot parse as an integer.
            bool success = await gate.SubmitAsync();

            Assert.IsFalse(success);
            Assert.AreEqual(0, transport.CallCount, "A format-only rejection must never reach the network");
        }

        // ----------------------------------------------------------------------------------
        // Shop: minors (under_13) must be redirected to the parental gate before any purchase
        // request reaches the server; non-minors purchase directly.
        // ----------------------------------------------------------------------------------

        [Test]
        public async Task Test_Shop_RedirectsMinorsToParentalGate_WithoutCallingServer()
        {
            var api = MakeService(out var transport);
            var shop = new ShopController(api);

            string gatedSku = null;
            shop.OnParentalGateRequired += sku => gatedSku = sku;

            await shop.RequestPurchaseAsync("cores_small", "under_13");

            Assert.AreEqual("cores_small", gatedSku, "under_13 purchases must raise the parental gate event");
            Assert.AreEqual("cores_small", shop.PendingSkuId);
            Assert.AreEqual(0, transport.CallCount, "No purchase request should be sent before the gate is cleared");
        }

        [Test]
        public async Task Test_Shop_AdultPurchase_SkipsParentalGate_AndCallsServer()
        {
            var api = MakeService(out var transport);
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"status\":\"granted\",\"entitlement\":{\"chips\":0,\"cores\":50,\"sku\":\"cores_small\"}}"
            });

            var shop = new ShopController(api);
            bool gateRequested = false;
            shop.OnParentalGateRequired += _ => gateRequested = true;

            await shop.RequestPurchaseAsync("cores_small", "16_plus");

            Assert.IsFalse(gateRequested, "16_plus should never be routed through the parental gate");
            Assert.AreEqual(1, transport.CallCount, "Adult purchase should call the purchase receipt endpoint directly");
            Assert.IsNotNull(shop.LastGrantedEntitlement);
        }

        [Test]
        public async Task Test_Shop_MinorPurchase_CompletesOnlyAfterGateToken()
        {
            var api = MakeService(out var transport);
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"status\":\"granted\",\"entitlement\":{\"chips\":0,\"cores\":50,\"sku\":\"cores_small\"}}"
            });

            var shop = new ShopController(api);
            await shop.RequestPurchaseAsync("cores_small", "under_13");
            Assert.AreEqual(0, transport.CallCount);

            // Simulate the parental gate having been cleared and a token minted server-side.
            await shop.CompletePurchaseAsync(shop.PendingSkuId, "pgt_xyz");

            Assert.AreEqual(1, transport.CallCount);
            var sentHeaders = transport.RequestedHeaders[0];
            Assert.IsTrue(sentHeaders.ContainsKey("Idempotency-Key"), "Purchase receipt submission must carry an Idempotency-Key");
        }

        // ----------------------------------------------------------------------------------
        // Supply drops: odds must only ever come from the server response object, never a
        // hardcoded client-side literal.
        // ----------------------------------------------------------------------------------

        [Test]
        public async Task Test_SupplyDrop_OddsTable_OnlyReflectsServerResponse()
        {
            var api = MakeService(out var transport);
            // Deliberately odd, non-"round" probability values that could never plausibly be a
            // hardcoded client-side guess — proves the values flow straight from the response.
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"table_id\":\"standard-v7\",\"version\":7," +
                            "\"entries\":[{\"reward\":\"chips_small\",\"probability\":0.4173,\"item_type\":\"chips\",\"min_amount\":10,\"max_amount\":50}," +
                            "{\"reward\":\"cores_rare\",\"probability\":0.0081,\"item_type\":\"cores\",\"min_amount\":5,\"max_amount\":5}]}"
            });

            var drops = new SupplyDropController(api);
            await drops.OpenAsync();

            Assert.IsNotNull(drops.OddsTable);
            Assert.AreEqual(2, drops.OddsTable.entries.Length);
            Assert.AreEqual(0.4173f, drops.OddsTable.entries[0].probability, 0.0001f, "Probability must come verbatim from the server");
            Assert.AreEqual(0.0081f, drops.OddsTable.entries[1].probability, 0.0001f, "Probability must come verbatim from the server");
        }

        [Test]
        public async Task Test_SupplyDrop_OpenDrop_IsIdempotent()
        {
            var api = MakeService(out var transport);
            transport.EnqueueResponse(new HttpResponse { StatusCode = 200, BodyJson = "{\"table_id\":\"standard-v7\",\"version\":7,\"entries\":[]}" });
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"open_id\":\"o1\",\"table_id\":\"standard-v7\",\"table_version\":7,\"result\":{\"reward\":\"chips_small\",\"amount\":25,\"item_type\":\"chips\"}}"
            });

            var drops = new SupplyDropController(api);
            await drops.OpenAsync();
            await drops.OpenDropAsync();

            var openDropHeaders = transport.RequestedHeaders[1];
            Assert.IsTrue(openDropHeaders.ContainsKey("Idempotency-Key"));
            Assert.AreEqual(25, drops.LastDropResult.amount);
        }

        // ----------------------------------------------------------------------------------
        // Idempotency: every mutating SkylineRushApiService call generates a fresh
        // Idempotency-Key header (CLAUDE.md #3), and distinct calls get distinct keys.
        // ----------------------------------------------------------------------------------

        [Test]
        public async Task Test_ApiService_SubmitRun_SendsIdempotencyKey()
        {
            var api = MakeService(out var transport);
            transport.DefaultResponse = new HttpResponse
            {
                StatusCode = 201,
                BodyJson = "{\"run_id\":\"r1\",\"integrity_flag\":\"ok\",\"rewards\":{\"chips_granted\":1,\"cores_granted\":0,\"pass_xp_granted\":1},\"new_district_best\":false}"
            };

            var request = new RunSubmitRequestDto
            {
                district_id = "neo-marina",
                runner_id = "vex",
                board_id = "ion-glide",
                meters = 100,
                chips_collected = 5,
                client_submitted_at = "2026-01-01T00:00:00Z",
                duration_seconds = 20f
            };

            await api.SubmitRunAsync(request);
            AssertHasIdempotencyKey(transport, 0);
        }

        [Test]
        public async Task Test_ApiService_Redeploy_SendsIdempotencyKey()
        {
            var api = MakeService(out var transport);
            transport.DefaultResponse = new HttpResponse { StatusCode = 200, BodyJson = "{\"cores_spent\":10,\"cores_remaining\":40}" };
            await api.RedeployAsync("run-1", "cores");
            AssertHasIdempotencyKey(transport, 0);
        }

        [Test]
        public async Task Test_ApiService_ClaimContract_SendsIdempotencyKey()
        {
            var api = MakeService(out var transport);
            transport.DefaultResponse = new HttpResponse { StatusCode = 200, BodyJson = "{\"contract_id\":\"c1\",\"reward\":{\"chips\":10,\"cores\":0}}" };
            await api.ClaimContractAsync("c1");
            AssertHasIdempotencyKey(transport, 0);
        }

        [Test]
        public async Task Test_ApiService_UnlockRosterItem_SendsIdempotencyKey()
        {
            var api = MakeService(out var transport);
            transport.DefaultResponse = new HttpResponse { StatusCode = 200, BodyJson = "{\"ok\":true,\"balance\":{\"chips\":0,\"cores\":0}}" };
            await api.UnlockRosterItemAsync("runner", "kael");
            AssertHasIdempotencyKey(transport, 0);
        }

        [Test]
        public async Task Test_ApiService_SubmitPurchaseReceipt_SendsIdempotencyKey()
        {
            var api = MakeService(out var transport);
            transport.DefaultResponse = new HttpResponse { StatusCode = 200, BodyJson = "{\"status\":\"granted\",\"entitlement\":{\"chips\":0,\"cores\":50}}" };
            await api.SubmitPurchaseReceiptAsync("cores_small", "tx1", "sig1");
            AssertHasIdempotencyKey(transport, 0);
        }

        [Test]
        public async Task Test_ApiService_MutatingCalls_GenerateDistinctIdempotencyKeys()
        {
            var api = MakeService(out var transport);
            transport.DefaultResponse = new HttpResponse { StatusCode = 200, BodyJson = "{\"contract_id\":\"c1\",\"reward\":{\"chips\":10,\"cores\":0}}" };

            await api.ClaimContractAsync("c1");
            await api.ClaimContractAsync("c1");

            string key1 = transport.RequestedHeaders[0]["Idempotency-Key"];
            string key2 = transport.RequestedHeaders[1]["Idempotency-Key"];
            Assert.AreNotEqual(key1, key2, "Each mutating call must mint its own fresh idempotency key by default");
        }

        [Test]
        public async Task Test_ApiService_NonMutatingCalls_OmitIdempotencyKey()
        {
            var api = MakeService(out var transport);
            transport.DefaultResponse = new HttpResponse { StatusCode = 200, BodyJson = "{\"ok\":true}" };
            await api.EquipRosterItemAsync("runner", "vex");

            var headers = transport.RequestedHeaders[0];
            Assert.IsFalse(headers.ContainsKey("Idempotency-Key"), "roster/equip has no IdempotencyKeyHeader parameter in openapi.yaml");
        }

        private static void AssertHasIdempotencyKey(FakeHttpTransport transport, int requestIndex)
        {
            var headers = transport.RequestedHeaders[requestIndex];
            Assert.IsTrue(headers.ContainsKey("Idempotency-Key"), "Mutating call must carry an Idempotency-Key header");
            Assert.IsFalse(string.IsNullOrEmpty(headers["Idempotency-Key"]), "Idempotency-Key must not be empty");
        }

        // ----------------------------------------------------------------------------------
        // Contracts: claim is idempotent and progress math never divides by zero.
        // ----------------------------------------------------------------------------------

        [Test]
        public void Test_ContractsController_ProgressPercent_GuardsZeroTarget()
        {
            var contract = new ContractItemDto { progress = 5, target = 0 };
            Assert.AreEqual(0, ContractsController.ComputeProgressPercent(contract));
        }

        [Test]
        public void Test_ContractsController_ProgressPercent_Clamps100()
        {
            var contract = new ContractItemDto { progress = 999, target = 10 };
            Assert.AreEqual(100, ContractsController.ComputeProgressPercent(contract));
        }

        // ----------------------------------------------------------------------------------
        // Roster: unlocking never flips local "owned" state — it must always re-fetch from
        // the server (CLAUDE.md #1: client never grants unlocks itself).
        // ----------------------------------------------------------------------------------

        [Test]
        public async Task Test_RosterController_Unlock_RefetchesFromServer_NeverGrantsLocally()
        {
            var api = MakeService(out var transport);
            // Initial catalog load: item is locked.
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"runners\":[{\"id\":\"kael\",\"name\":\"Kael\",\"owned\":false,\"equipped\":false,\"unlock_cost_cores\":50}],\"boards\":[]}"
            });
            // Unlock call itself.
            transport.EnqueueResponse(new HttpResponse { StatusCode = 200, BodyJson = "{\"ok\":true,\"balance\":{\"chips\":0,\"cores\":0}}" });
            // Re-fetch after unlock: now server reports it owned.
            transport.EnqueueResponse(new HttpResponse
            {
                StatusCode = 200,
                BodyJson = "{\"runners\":[{\"id\":\"kael\",\"name\":\"Kael\",\"owned\":true,\"equipped\":false,\"unlock_cost_cores\":50}],\"boards\":[]}"
            });

            var roster = new RosterController(api);
            await roster.OpenAsync();
            Assert.IsFalse(roster.Runners[0].owned);

            await roster.UnlockAsync(RosterTab.Runners, "kael");

            Assert.AreEqual(3, transport.CallCount, "Unlock must trigger a server re-fetch, not a local flag flip");
            Assert.IsTrue(roster.Runners[0].owned, "Owned state must reflect the server's post-unlock re-fetch response");

            var unlockHeaders = transport.RequestedHeaders[1];
            Assert.IsTrue(unlockHeaders.ContainsKey("Idempotency-Key"));
        }

        // ----------------------------------------------------------------------------------
        // Settings: friend code derivation matches the web client, and age bucket is only ever
        // populated from a server-provided value (no client mutation path exists).
        // ----------------------------------------------------------------------------------

        [Test]
        public void Test_SettingsController_FriendCode_MatchesWebClientAlgorithm()
        {
            var api = MakeService(out _);
            var settings = new SettingsController(api);

            settings.SetPlayerId("a1b2c3d4-e5f6-4444-8888-000000000000");
            Assert.AreEqual("SKY-A1B2", settings.MyFriendCode);
        }

        [Test]
        public void Test_SettingsController_AgeBucket_OnlyReflectsServerValue()
        {
            var api = MakeService(out _);
            var settings = new SettingsController(api);

            Assert.AreEqual("16_plus", settings.AgeBucket, "Default should be the safe/non-personalized fallback");
            settings.SetAgeBucketFromServer("under_13");
            Assert.AreEqual("under_13", settings.AgeBucket);
        }

        [Test]
        public async Task Test_SettingsController_DataExport_RedirectsMinorsToParentalGate()
        {
            var api = MakeService(out var transport);
            var settings = new SettingsController(api);
            settings.SetAgeBucketFromServer("under_13");

            PendingGatedAction requested = PendingGatedAction.None;
            settings.OnParentalGateRequired += action => requested = action;

            await settings.RequestDataExportAsync();

            Assert.AreEqual(PendingGatedAction.DataExport, requested);
            Assert.AreEqual(0, transport.CallCount, "No export request should be sent before the gate is cleared");
        }
    }
}
