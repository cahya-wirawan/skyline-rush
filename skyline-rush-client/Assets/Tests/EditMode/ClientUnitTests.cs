using System;
using System.IO;
using System.Collections.Generic;
using SkylineRush.Run;
using SkylineRush.ProceduralGen;
using SkylineRush.Storage;
using SkylineRush.Networking;
using SkylineRush.Ads;
using SkylineRush.Analytics;
using SkylineRush.Meta;

namespace SkylineRush.Tests
{
    public class ClientUnitTests
    {
        // AC-13: 3-Lane State Machine, Input Buffering, Jump/Slide Transitions
        public static void Test_AC13_CoreLoopTransitions()
        {
            var lane = new LaneStateMachine();
            var input = new InputBuffer();
            var jumpSlide = new JumpSlideController();

            // 1. Swipe Left from Center
            lane.TryChangeLane(-1);
            lane.Update(0.2f); // complete transition
            if (lane.CurrentLane != Lane.Left) throw new Exception("Expected CurrentLane to be Left");

            // 2. Input buffer holds swipe
            input.RegisterInput(InputAction.SwipeRight);
            input.Update(0.05f);
            if (input.ConsumeInput() != InputAction.SwipeRight) throw new Exception("Expected buffered SwipeRight");

            // 3. Mid-air swipe down -> slides immediately upon landing
            jumpSlide.Jump();
            jumpSlide.Update(0.1f);
            if (jumpSlide.State != VerticalState.Jumping) throw new Exception("Expected Jumping state");

            // Swipe down while mid-air
            jumpSlide.Slide();
            // Advance through jump completion
            jumpSlide.Update(0.6f);
            if (jumpSlide.State != VerticalState.Sliding) throw new Exception("Expected immediate slide on landing");

            // 4. Vacated lane obstacle collision immunity
            var collision = new ObstacleCollisionHandler();
            var obsInCenter = new Obstacle(Lane.Center, 10f, ObstacleType.FullBlocker);
            // Runner is in Left lane (vacated Center)
            bool hit = collision.CheckCollision(obsInCenter, Lane.Left, 10f, VerticalState.Running, 0f, false, Lane.Left);
            if (hit) throw new Exception("Expected obstacle in vacated lane to not collide");
        }

        // AC-14: Seeded Deterministic Procedural Track Generator
        public static void Test_AC14_ProceduralGeneratorInvariants()
        {
            var gen1 = new ProceduralTrackGenerator(seed: 12345);
            var track1 = gen1.GenerateTrackSequence(20);

            var gen2 = new ProceduralTrackGenerator(seed: 12345);
            var track2 = gen2.GenerateTrackSequence(20);

            // Determinism check
            if (track1.Count != track2.Count) throw new Exception("Seed determinism count mismatch");
            for (int i = 0; i < track1.Count; i++)
            {
                if (track1[i].SegmentId != track2[i].SegmentId) throw new Exception($"Track diverged at segment {i}");
            }

            // Guaranteed survivable path check
            var validator = new SurvivablePathValidator();
            if (!validator.ValidateChainedSequence(track1))
            {
                throw new Exception("Generated track failed chained survivable path invariant");
            }

            // Breathing room check after maximum difficulty
            for (int i = 0; i < track1.Count - 1; i++)
            {
                if (track1[i].Difficulty == DifficultyBand.Maximum)
                {
                    if (track1[i + 1].Difficulty != DifficultyBand.BreathingRoom)
                    {
                        throw new Exception($"Expected BreathingRoom after Maximum segment at index {i}");
                    }
                }
            }
        }

        // AC-15: Offline Outbox FIFO Queue & Local Storage
        public static void Test_AC15_OutboxAndStorage()
        {
            var storage = new SQLiteStorageLayer();
            var keychain = new KeychainWrapper();
            var outbox = new OutboxQueue();

            // Keychain test
            keychain.SaveSecure("refresh_token", "jwt_refresh_secret_123");
            if (keychain.GetSecure("refresh_token") != "jwt_refresh_secret_123")
            {
                throw new Exception("Keychain read/write mismatch");
            }

            // CRIT-10: File persistence test
            string testStorePath = Path.Combine(Path.GetTempPath(), "skyline_test_store.txt");
            var persistentStorage = new SQLiteStorageLayer(testStorePath);
            persistentStorage.SetString("saved_best_score", "9500");
            var loadedStorage = new SQLiteStorageLayer(testStorePath);
            if (loadedStorage.GetString("saved_best_score") != "9500")
            {
                throw new Exception("File-based storage persistence failed");
            }
            if (File.Exists(testStorePath)) File.Delete(testStorePath);

            // CRIT-03: Enqueue entries with run_id in redeploy payload
            outbox.Enqueue("/v1/runs/redeploy", "{\"run_id\":\"run_001\",\"method\":\"cores\"}", "key_redeploy_1", true);
            outbox.Enqueue("/v1/runs", "{\"meters\":1200}", "key_run_1", true);

            if (outbox.Count != 2) throw new Exception("Expected 2 outbox entries");

            var first = outbox.PeekNext();
            if (first.IdempotencyKey != "key_redeploy_1") throw new Exception("Expected FIFO order");

            // Capacity & bounded eviction test (cap 500)
            outbox.Clear();
            for (int i = 0; i < OutboxQueue.MaxEntriesCapacity; i++)
            {
                outbox.Enqueue("/v1/analytics", "{}", $"analytics_{i}", false);
            }

            // Enqueueing economy critical entry when full of analytics should evict oldest analytics entry
            bool success = outbox.Enqueue("/v1/runs", "{}", "critical_run", true);
            if (!success || outbox.Count != OutboxQueue.MaxEntriesCapacity)
            {
                throw new Exception("Expected outbox to maintain bounded capacity by evicting non-critical entries");
            }
        }

        // AC-16: Ads & Analytics Age-Bucket Gating
        public static void Test_AC16_AgeGatingAndConsent()
        {
            var ads = new AdMediationWrapper();
            var analytics = new AnalyticsManager();

            // Under 13 child account
            ads.InitializeWithServerConsent("under_13", true); // Even if true passed, server rule overrides
            if (ads.CanShowPersonalizedAds())
            {
                throw new Exception("Ad personalization must be disabled for under_13");
            }

            // 13-15 teen account
            ads.InitializeWithServerConsent("13_15", true);
            if (ads.CanShowPersonalizedAds())
            {
                throw new Exception("Ad personalization must be disabled for 13_15");
            }

            // 16+ adult account with consent
            ads.InitializeWithServerConsent("16_plus", true);
            if (!ads.CanShowPersonalizedAds())
            {
                throw new Exception("Ad personalization should be permitted for 16_plus with consent");
            }

            // Analytics suppression
            analytics.ConfigureConsent("under_13", false);
            bool tracked = analytics.TrackEvent("test_run_started");
            if (tracked || analytics.EmittedEvents.Count != 0)
            {
                throw new Exception("Analytics must be suppressed when consent is false");
            }
        }
    }
}
