using System.IO;
using NUnit.Framework;
using SkylineRush.Run;
using SkylineRush.ProceduralGen;
using SkylineRush.Storage;
using SkylineRush.Ads;
using SkylineRush.Analytics;

namespace SkylineRush.Tests
{
    [TestFixture]
    public class ClientUnitTests
    {
        // AC-13: 3-Lane State Machine, Input Buffering, Jump/Slide Transitions
        [Test]
        public void Test_AC13_CoreLoopTransitions()
        {
            var lane = new LaneStateMachine();
            var input = new InputBuffer();
            var jumpSlide = new JumpSlideController();

            // 1. Swipe Left from Center
            lane.TryChangeLane(-1);
            lane.Update(0.2f); // complete transition
            Assert.AreEqual(Lane.Left, lane.CurrentLane, "Expected CurrentLane to be Left");

            // 2. Input buffer holds swipe
            input.RegisterInput(InputAction.SwipeRight);
            input.Update(0.05f);
            Assert.AreEqual(InputAction.SwipeRight, input.ConsumeInput(), "Expected buffered SwipeRight");

            // 3. Mid-air swipe down -> slides immediately upon landing
            jumpSlide.Jump();
            jumpSlide.Update(0.1f);
            Assert.AreEqual(VerticalState.Jumping, jumpSlide.State, "Expected Jumping state");

            // Swipe down while mid-air
            jumpSlide.Slide();
            // Advance through jump completion
            jumpSlide.Update(0.6f);
            Assert.AreEqual(VerticalState.Sliding, jumpSlide.State, "Expected immediate slide on landing");

            // 4. Vacated lane obstacle collision immunity
            var collision = new ObstacleCollisionHandler();
            var obsInCenter = new Obstacle(Lane.Center, 10f, ObstacleType.FullBlocker);
            // Runner is in Left lane (vacated Center)
            bool hit = collision.CheckCollision(obsInCenter, Lane.Left, 10f, VerticalState.Running, 0f, false, Lane.Left);
            Assert.IsFalse(hit, "Expected obstacle in vacated lane to not collide");
        }

        // AC-14: Seeded Deterministic Procedural Track Generator
        [Test]
        public void Test_AC14_ProceduralGeneratorInvariants()
        {
            var gen1 = new ProceduralTrackGenerator(seed: 12345);
            var track1 = gen1.GenerateTrackSequence(20);

            var gen2 = new ProceduralTrackGenerator(seed: 12345);
            var track2 = gen2.GenerateTrackSequence(20);

            // Determinism check
            Assert.AreEqual(track2.Count, track1.Count, "Seed determinism count mismatch");
            for (int i = 0; i < track1.Count; i++)
            {
                Assert.AreEqual(track2[i].SegmentId, track1[i].SegmentId, $"Track diverged at segment {i}");
            }

            // Guaranteed survivable path check
            var validator = new SurvivablePathValidator();
            Assert.IsTrue(validator.ValidateChainedSequence(track1), "Generated track failed chained survivable path invariant");

            // Breathing room check after maximum difficulty
            for (int i = 0; i < track1.Count - 1; i++)
            {
                if (track1[i].Difficulty == DifficultyBand.Maximum)
                {
                    Assert.AreEqual(
                        DifficultyBand.BreathingRoom, track1[i + 1].Difficulty,
                        $"Expected BreathingRoom after Maximum segment at index {i}"
                    );
                }
            }
        }

        // AC-15: Offline Outbox FIFO Queue & Local Storage
        [Test]
        public void Test_AC15_OutboxAndStorage()
        {
            var keychain = new KeychainWrapper();
            var outbox = new OutboxQueue();

            // Keychain test
            keychain.SaveSecure("refresh_token", "jwt_refresh_secret_123");
            Assert.AreEqual("jwt_refresh_secret_123", keychain.GetSecure("refresh_token"), "Keychain read/write mismatch");

            // CRIT-10: File persistence test
            string testStorePath = Path.Combine(Path.GetTempPath(), "skyline_test_store.txt");
            try
            {
                var persistentStorage = new SQLiteStorageLayer(testStorePath);
                persistentStorage.SetString("saved_best_score", "9500");
                var loadedStorage = new SQLiteStorageLayer(testStorePath);
                Assert.AreEqual("9500", loadedStorage.GetString("saved_best_score"), "File-based storage persistence failed");
            }
            finally
            {
                if (File.Exists(testStorePath)) File.Delete(testStorePath);
            }

            // CRIT-03: Enqueue entries with run_id in redeploy payload
            outbox.Enqueue("/v1/runs/redeploy", "{\"run_id\":\"run_001\",\"method\":\"cores\"}", "key_redeploy_1", true);
            outbox.Enqueue("/v1/runs", "{\"meters\":1200}", "key_run_1", true);

            Assert.AreEqual(2, outbox.Count, "Expected 2 outbox entries");

            var first = outbox.PeekNext();
            Assert.AreEqual("key_redeploy_1", first.IdempotencyKey, "Expected FIFO order");

            // Capacity & bounded eviction test (cap 500)
            outbox.Clear();
            for (int i = 0; i < OutboxQueue.MaxEntriesCapacity; i++)
            {
                outbox.Enqueue("/v1/analytics", "{}", $"analytics_{i}", false);
            }

            // Enqueueing economy critical entry when full of analytics should evict oldest analytics entry
            bool success = outbox.Enqueue("/v1/runs", "{}", "critical_run", true);
            Assert.IsTrue(success, "Expected outbox to accept the critical entry by evicting a non-critical one");
            Assert.AreEqual(OutboxQueue.MaxEntriesCapacity, outbox.Count, "Expected outbox to maintain bounded capacity");
        }

        // AC-16: Ads & Analytics Age-Bucket Gating
        [Test]
        public void Test_AC16_AgeGatingAndConsent()
        {
            var ads = new AdMediationWrapper();
            var analytics = new AnalyticsManager();

            // Under 13 child account
            ads.InitializeWithServerConsent("under_13", true); // Even if true passed, server rule overrides
            Assert.IsFalse(ads.CanShowPersonalizedAds(), "Ad personalization must be disabled for under_13");

            // 13-15 teen account
            ads.InitializeWithServerConsent("13_15", true);
            Assert.IsFalse(ads.CanShowPersonalizedAds(), "Ad personalization must be disabled for 13_15");

            // 16+ adult account with consent
            ads.InitializeWithServerConsent("16_plus", true);
            Assert.IsTrue(ads.CanShowPersonalizedAds(), "Ad personalization should be permitted for 16_plus with consent");

            // Analytics suppression
            analytics.ConfigureConsent("under_13", false);
            bool tracked = analytics.TrackEvent("test_run_started");
            Assert.IsFalse(tracked, "Analytics must be suppressed when consent is false");
            Assert.AreEqual(0, analytics.EmittedEvents.Count, "Analytics must be suppressed when consent is false");
        }
    }
}
