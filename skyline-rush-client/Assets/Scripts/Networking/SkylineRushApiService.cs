using System;
using System.Threading.Tasks;
using UnityEngine;

namespace SkylineRush.Networking
{
    /// <summary>
    /// Thrown when an <see cref="ApiClient"/> call made through <see cref="SkylineRushApiService"/>
    /// returns a non-2xx HTTP status. Carries the raw status code and response body so callers
    /// (e.g. ShopController checking for a 403 age-gate rejection, or an outbox path checking for
    /// a terminal 4xx per CLAUDE.md's dead-letter rule) can branch on it.
    /// </summary>
    public class ApiRequestException : Exception
    {
        public int StatusCode { get; }
        public string ResponseBody { get; }

        public ApiRequestException(int statusCode, string responseBody, string context)
            : base($"API request '{context}' failed with status {statusCode}: {responseBody}")
        {
            StatusCode = statusCode;
            ResponseBody = responseBody;
        }
    }

    /// <summary>
    /// Pure C# typed wrapper around <see cref="ApiClient"/> providing one strongly-typed async
    /// method per Skyline Rush Gateway endpoint (see skyline-rush-contracts/openapi.yaml), mirroring
    /// the surface of the reference web client's `Api` object in web/game.js.
    ///
    /// Idempotency: every mutating (state-changing) endpoint that openapi.yaml declares with the
    /// shared IdempotencyKeyHeader parameter accepts an optional idempotencyKey argument and
    /// generates a fresh GUID via Guid.NewGuid().ToString() when the caller doesn't supply one —
    /// the same pattern StoreKitWrapper already established for /v1/purchases/receipt. Per
    /// openapi.yaml, that applies to: submitRun, runs/redeploy, contracts/{id}/claim,
    /// supply-drops/open, roster/unlock, and purchases/receipt. Endpoints without that parameter
    /// in the spec (auth/guest, roster/equip, friends/add, privacy/export, privacy/delete,
    /// parental-gate/verify) intentionally do not send an Idempotency-Key header, matching both
    /// openapi.yaml and web/game.js's Api object.
    ///
    /// This class never fabricates or validates the parental-gate arithmetic answer itself
    /// (CLAUDE.md #2) — RequestParentalGateChallengeAsync only relays the server's question/token,
    /// and VerifyParentalGateAsync only forwards whatever integer the player typed back to the
    /// server for verification.
    /// </summary>
    public class SkylineRushApiService
    {
        private readonly ApiClient _apiClient;

        public SkylineRushApiService(ApiClient apiClient)
        {
            _apiClient = apiClient;
        }

        private static string NewIdempotencyKey() => Guid.NewGuid().ToString();

        private static T ParseResponse<T>(HttpResponse response, string context)
        {
            if (!response.IsSuccess)
            {
                throw new ApiRequestException(response.StatusCode, response.BodyJson, context);
            }
            return JsonUtility.FromJson<T>(response.BodyJson);
        }

        // -----------------------------------------------------------------
        // Auth / Profile / Economy
        // -----------------------------------------------------------------

        /// <summary>POST /v1/auth/guest. On success, also sets ApiClient.AccessToken to the returned access_token.</summary>
        public async Task<AuthResponseDto> AuthGuestAsync(string guestDeviceId, string ageBucket)
        {
            var req = new AuthGuestRequestDto { guest_device_id = guestDeviceId, age_bucket = ageBucket };
            var response = await _apiClient.PostAsync("/v1/auth/guest", JsonUtility.ToJson(req));
            var dto = ParseResponse<AuthResponseDto>(response, "auth/guest");
            if (dto != null && !string.IsNullOrEmpty(dto.access_token))
            {
                _apiClient.AccessToken = dto.access_token;
            }
            return dto;
        }

        /// <summary>GET /v1/profile.</summary>
        public async Task<ProfileResponseDto> GetProfileAsync()
        {
            var response = await _apiClient.GetAsync("/v1/profile");
            return ParseResponse<ProfileResponseDto>(response, "profile");
        }

        /// <summary>GET /v1/economy/balance.</summary>
        public async Task<BalanceResponseDto> GetBalanceAsync()
        {
            var response = await _apiClient.GetAsync("/v1/economy/balance");
            return ParseResponse<BalanceResponseDto>(response, "economy/balance");
        }

        // -----------------------------------------------------------------
        // Runs
        // -----------------------------------------------------------------

        /// <summary>POST /v1/runs. Idempotency-Key required by openapi.yaml.</summary>
        public async Task<RunSubmitResponseDto> SubmitRunAsync(RunSubmitRequestDto request, string idempotencyKey = null)
        {
            var response = await _apiClient.PostAsync("/v1/runs", JsonUtility.ToJson(request), idempotencyKey ?? NewIdempotencyKey());
            return ParseResponse<RunSubmitResponseDto>(response, "runs");
        }

        /// <summary>POST /v1/runs/redeploy (run_id in body). Idempotency-Key required by openapi.yaml.</summary>
        public async Task<RedeployResponseDto> RedeployAsync(string runId, string method, string adReceipt = null, string idempotencyKey = null)
        {
            var req = new RedeployRequestDto { run_id = runId, method = method, ad_receipt = adReceipt };
            var response = await _apiClient.PostAsync("/v1/runs/redeploy", JsonUtility.ToJson(req), idempotencyKey ?? NewIdempotencyKey());
            return ParseResponse<RedeployResponseDto>(response, "runs/redeploy");
        }

        // -----------------------------------------------------------------
        // Leaderboard
        // -----------------------------------------------------------------

        /// <summary>GET /v1/leaderboard?scope=&amp;district_id=&amp;cursor=&amp;limit=.</summary>
        public async Task<LeaderboardResponseDto> GetLeaderboardAsync(string districtId = "neo-marina", int limit = 15, string scope = null, string cursor = null)
        {
            string path = $"/v1/leaderboard?district_id={Uri.EscapeDataString(districtId)}&limit={limit}";
            if (!string.IsNullOrEmpty(scope)) path += $"&scope={Uri.EscapeDataString(scope)}";
            if (!string.IsNullOrEmpty(cursor)) path += $"&cursor={Uri.EscapeDataString(cursor)}";

            var response = await _apiClient.GetAsync(path);
            return ParseResponse<LeaderboardResponseDto>(response, "leaderboard");
        }

        // -----------------------------------------------------------------
        // Supply Drops (CLAUDE.md #6: odds must always come from this server response, never a
        // client-side literal)
        // -----------------------------------------------------------------

        /// <summary>GET /v1/supply-drops/tables/{table_id}. Returns the server-disclosed odds table.</summary>
        public async Task<SupplyDropTableResponseDto> GetSupplyDropTableAsync(string tableId = "standard-v7")
        {
            var response = await _apiClient.GetAsync($"/v1/supply-drops/tables/{Uri.EscapeDataString(tableId)}");
            return ParseResponse<SupplyDropTableResponseDto>(response, "supply-drops/tables");
        }

        /// <summary>POST /v1/supply-drops/open. Idempotency-Key required by openapi.yaml.</summary>
        public async Task<SupplyDropOpenResponseDto> OpenSupplyDropAsync(string acquiredVia = "earned", string tableId = null, string idempotencyKey = null)
        {
            var req = new SupplyDropOpenRequestDto { acquired_via = acquiredVia, table_id = tableId };
            var response = await _apiClient.PostAsync("/v1/supply-drops/open", JsonUtility.ToJson(req), idempotencyKey ?? NewIdempotencyKey());
            return ParseResponse<SupplyDropOpenResponseDto>(response, "supply-drops/open");
        }

        // -----------------------------------------------------------------
        // Contracts
        // -----------------------------------------------------------------

        /// <summary>GET /v1/contracts/active.</summary>
        public async Task<ActiveContractsResponseDto> GetActiveContractsAsync()
        {
            var response = await _apiClient.GetAsync("/v1/contracts/active");
            return ParseResponse<ActiveContractsResponseDto>(response, "contracts/active");
        }

        /// <summary>POST /v1/contracts/{contract_id}/claim. Idempotency-Key required by openapi.yaml. Empty request body (path-param only).</summary>
        public async Task<ClaimContractResponseDto> ClaimContractAsync(string contractId, string idempotencyKey = null)
        {
            var response = await _apiClient.PostAsync($"/v1/contracts/{Uri.EscapeDataString(contractId)}/claim", string.Empty, idempotencyKey ?? NewIdempotencyKey());
            return ParseResponse<ClaimContractResponseDto>(response, "contracts/claim");
        }

        // -----------------------------------------------------------------
        // Roster (client only initiates unlock/equip requests — the server is the sole authority
        // over granting the unlock, per CLAUDE.md #1)
        // -----------------------------------------------------------------

        /// <summary>GET /v1/roster.</summary>
        public async Task<RosterResponseDto> GetRosterAsync()
        {
            var response = await _apiClient.GetAsync("/v1/roster");
            return ParseResponse<RosterResponseDto>(response, "roster");
        }

        /// <summary>POST /v1/roster/equip. No Idempotency-Key parameter in openapi.yaml for this endpoint.</summary>
        public async Task<RosterEquipResponseDto> EquipRosterItemAsync(string itemType, string itemId)
        {
            var req = new RosterEquipRequestDto { item_type = itemType, item_id = itemId };
            var response = await _apiClient.PostAsync("/v1/roster/equip", JsonUtility.ToJson(req));
            return ParseResponse<RosterEquipResponseDto>(response, "roster/equip");
        }

        /// <summary>POST /v1/roster/unlock. Idempotency-Key required by openapi.yaml. method is always "cores" per RosterUnlockRequest schema.</summary>
        public async Task<RosterUnlockResponseDto> UnlockRosterItemAsync(string itemType, string itemId, string idempotencyKey = null)
        {
            var req = new RosterUnlockRequestDto { item_type = itemType, item_id = itemId, method = "cores" };
            var response = await _apiClient.PostAsync("/v1/roster/unlock", JsonUtility.ToJson(req), idempotencyKey ?? NewIdempotencyKey());
            return ParseResponse<RosterUnlockResponseDto>(response, "roster/unlock");
        }

        // -----------------------------------------------------------------
        // Parental Gate — the client NEVER computes or validates the arithmetic answer (CLAUDE.md #2).
        // -----------------------------------------------------------------

        /// <summary>GET /v1/auth/parental-gate/challenge. No auth required per openapi.yaml.</summary>
        public async Task<ParentalGateChallengeResponseDto> RequestParentalGateChallengeAsync()
        {
            var response = await _apiClient.GetAsync("/v1/auth/parental-gate/challenge");
            return ParseResponse<ParentalGateChallengeResponseDto>(response, "auth/parental-gate/challenge");
        }

        /// <summary>POST /v1/auth/parental-gate/verify. No Idempotency-Key parameter in openapi.yaml for this endpoint.</summary>
        public async Task<ParentalGateVerifyResponseDto> VerifyParentalGateAsync(string challengeToken, int answer)
        {
            var req = new ParentalGateVerifyRequestDto { challenge_token = challengeToken, answer = answer };
            var response = await _apiClient.PostAsync("/v1/auth/parental-gate/verify", JsonUtility.ToJson(req));
            return ParseResponse<ParentalGateVerifyResponseDto>(response, "auth/parental-gate/verify");
        }

        // -----------------------------------------------------------------
        // Purchases
        // -----------------------------------------------------------------

        /// <summary>POST /v1/purchases/receipt. Idempotency-Key required by openapi.yaml.</summary>
        public async Task<PurchaseReceiptResponseDto> SubmitPurchaseReceiptAsync(
            string sku,
            string transactionId,
            string signedTransaction,
            bool parentalGatePassed = false,
            string parentalGateToken = null,
            string idempotencyKey = null)
        {
            var req = new PurchaseReceiptRequestDto
            {
                sku = sku,
                transaction_id = transactionId,
                signed_transaction = signedTransaction,
                parental_gate_passed = parentalGatePassed,
                parental_gate_token = parentalGateToken
            };
            var response = await _apiClient.PostAsync("/v1/purchases/receipt", JsonUtility.ToJson(req), idempotencyKey ?? NewIdempotencyKey());
            return ParseResponse<PurchaseReceiptResponseDto>(response, "purchases/receipt");
        }

        // -----------------------------------------------------------------
        // Friends
        // -----------------------------------------------------------------

        /// <summary>POST /v1/friends/add. No Idempotency-Key parameter in openapi.yaml for this endpoint.</summary>
        public async Task<FriendAddResponseDto> AddFriendAsync(string friendCode)
        {
            var req = new FriendAddRequestDto { method = "friend_code", code = friendCode };
            var response = await _apiClient.PostAsync("/v1/friends/add", JsonUtility.ToJson(req));
            return ParseResponse<FriendAddResponseDto>(response, "friends/add");
        }

        // -----------------------------------------------------------------
        // Privacy (GDPR) — paths follow openapi.yaml (/v1/privacy/export, /v1/privacy/delete),
        // which differ from the reference web client's /v1/privacy/data-export and
        // /v1/privacy/delete-account; openapi.yaml is the contract source of truth.
        // -----------------------------------------------------------------

        /// <summary>POST /v1/privacy/export (GDPR Art. 15). No Idempotency-Key parameter in openapi.yaml.</summary>
        public async Task<PrivacyExportResponseDto> ExportPrivacyDataAsync(bool parentalGatePassed = false, string parentalGateToken = null)
        {
            var req = new PrivacyExportRequestDto { parental_gate_passed = parentalGatePassed, parental_gate_token = parentalGateToken };
            var response = await _apiClient.PostAsync("/v1/privacy/export", JsonUtility.ToJson(req));
            return ParseResponse<PrivacyExportResponseDto>(response, "privacy/export");
        }

        /// <summary>POST /v1/privacy/delete (GDPR Art. 17). No Idempotency-Key parameter in openapi.yaml.</summary>
        public async Task<PrivacyDeleteResponseDto> DeletePrivacyDataAsync(bool parentalGatePassed = false, string parentalGateToken = null)
        {
            var req = new PrivacyDeleteRequestDto { parental_gate_passed = parentalGatePassed, parental_gate_token = parentalGateToken };
            var response = await _apiClient.PostAsync("/v1/privacy/delete", JsonUtility.ToJson(req));
            return ParseResponse<PrivacyDeleteResponseDto>(response, "privacy/delete");
        }
    }
}
