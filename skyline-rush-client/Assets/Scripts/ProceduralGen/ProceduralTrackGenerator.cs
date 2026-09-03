using System;
using System.Collections.Generic;
using SkylineRush.Run;

namespace SkylineRush.ProceduralGen
{
    public class ProceduralTrackGenerator
    {
        private Random _rng;
        private readonly SurvivablePathValidator _validator = new SurvivablePathValidator();
        private readonly List<TrackSegment> _catalog = new List<TrackSegment>();

        public int Seed { get; private set; }
        public DifficultyBand LastGeneratedDifficulty { get; private set; } = DifficultyBand.Easy;
        public LaneMask CurrentExitLaneMask { get; private set; } = LaneMask.All;

        public ProceduralTrackGenerator(int seed = 42)
        {
            Initialize(seed);
            BuildCatalog();
        }

        public void Initialize(int seed)
        {
            Seed = seed;
            _rng = new Random(seed);
            LastGeneratedDifficulty = DifficultyBand.Easy;
            CurrentExitLaneMask = LaneMask.All;
        }

        private void BuildCatalog()
        {
            _catalog.Clear();

            // 1. Breathing Room segment (wide open, no obstacles)
            var segBreathing = new TrackSegment("seg_breathing_1", DifficultyBand.BreathingRoom, 30f)
            {
                ValidEntryLanes = LaneMask.All,
                ValidExitLanes = LaneMask.All
            };
            _catalog.Add(segBreathing);

            // 2. Easy - Jump Low Barrier in Center lane only
            var segEasy1 = new TrackSegment("seg_easy_jump_center", DifficultyBand.Easy, 30f)
            {
                ValidEntryLanes = LaneMask.All,
                ValidExitLanes = LaneMask.All
            };
            segEasy1.Obstacles.Add(new Obstacle(Lane.Center, 15f, ObstacleType.LowBarrier));
            _catalog.Add(segEasy1);

            // 3. Easy - Slide High Barrier in Left lane only
            var segEasy2 = new TrackSegment("seg_easy_slide_left", DifficultyBand.Easy, 30f)
            {
                ValidEntryLanes = LaneMask.All,
                ValidExitLanes = LaneMask.All
            };
            segEasy2.Obstacles.Add(new Obstacle(Lane.Left, 15f, ObstacleType.HighBarrier));
            _catalog.Add(segEasy2);

            // 4. Medium - Double Obstacle (Left Blocked, Right Jump)
            var segMed1 = new TrackSegment("seg_med_split", DifficultyBand.Medium, 35f)
            {
                ValidEntryLanes = LaneMask.All,
                ValidExitLanes = LaneMask.Center | LaneMask.Right
            };
            segMed1.Obstacles.Add(new Obstacle(Lane.Left, 10f, ObstacleType.FullBlocker));
            segMed1.Obstacles.Add(new Obstacle(Lane.Right, 20f, ObstacleType.LowBarrier));
            _catalog.Add(segMed1);

            // 5. Hard - Staggered Jumps and Slides
            var segHard1 = new TrackSegment("seg_hard_weave", DifficultyBand.Hard, 40f)
            {
                ValidEntryLanes = LaneMask.All,
                ValidExitLanes = LaneMask.Left | LaneMask.Center
            };
            segHard1.Obstacles.Add(new Obstacle(Lane.Center, 10f, ObstacleType.FullBlocker));
            segHard1.Obstacles.Add(new Obstacle(Lane.Right, 15f, ObstacleType.FullBlocker));
            segHard1.Obstacles.Add(new Obstacle(Lane.Left, 25f, ObstacleType.LowBarrier));
            _catalog.Add(segHard1);

            // 6. Maximum Difficulty - Tight Squeeze with High Barrier & Blockers
            var segMax = new TrackSegment("seg_max_gauntlet", DifficultyBand.Maximum, 45f)
            {
                ValidEntryLanes = LaneMask.Left | LaneMask.Center,
                ValidExitLanes = LaneMask.Right
            };
            segMax.Obstacles.Add(new Obstacle(Lane.Left, 10f, ObstacleType.FullBlocker));
            segMax.Obstacles.Add(new Obstacle(Lane.Center, 20f, ObstacleType.HighBarrier));
            segMax.Obstacles.Add(new Obstacle(Lane.Left, 30f, ObstacleType.FullBlocker));
            segMax.Obstacles.Add(new Obstacle(Lane.Center, 30f, ObstacleType.FullBlocker));
            _catalog.Add(segMax);
        }

        public TrackSegment GenerateNextSegment(DifficultyBand targetDifficulty = DifficultyBand.Easy)
        {
            // Requirement from 07_AI_OR_AUTOMATION_PIPELINE.md:
            // "the runtime selector additionally enforces a minimum 'breathing room' segment after any maximum-difficulty segment."
            if (LastGeneratedDifficulty == DifficultyBand.Maximum)
            {
                targetDifficulty = DifficultyBand.BreathingRoom;
            }

            // Find matching candidates from catalog:
            // 1. Matches target difficulty
            // 2. Compatible entry lane with previous exit lane mask
            // 3. Pass survivability check
            var candidates = _catalog.FindAll(s =>
                s.Difficulty == targetDifficulty &&
                (s.ValidEntryLanes & CurrentExitLaneMask) != 0
            );

            // Fallback to any compatible segment if target difficulty has no candidate
            if (candidates.Count == 0)
            {
                candidates = _catalog.FindAll(s => (s.ValidEntryLanes & CurrentExitLaneMask) != 0);
            }

            if (candidates.Count == 0)
            {
                // Ultimate fallback: open breathing segment
                candidates = _catalog.FindAll(s => s.Difficulty == DifficultyBand.BreathingRoom);
            }

            int index = _rng.Next(candidates.Count);
            var selected = candidates[index];

            // Invariant check: mathematically guaranteed survivable path
            if (!_validator.HasSurvivablePath(selected))
            {
                throw new InvalidOperationException($"Segment {selected.SegmentId} violated survivable path invariant!");
            }

            LastGeneratedDifficulty = selected.Difficulty;
            CurrentExitLaneMask = selected.ValidExitLanes;

            return selected;
        }

        public List<TrackSegment> GenerateTrackSequence(int segmentCount, DifficultyBand startDifficulty = DifficultyBand.Easy)
        {
            var result = new List<TrackSegment>();
            DifficultyBand currentDiff = startDifficulty;

            for (int i = 0; i < segmentCount; i++)
            {
                var segment = GenerateNextSegment(currentDiff);
                result.Add(segment);

                // Gradually ramp difficulty
                if (currentDiff < DifficultyBand.Maximum && segment.Difficulty != DifficultyBand.BreathingRoom)
                {
                    currentDiff = (DifficultyBand)((int)currentDiff + 1);
                }
                else if (segment.Difficulty == DifficultyBand.BreathingRoom)
                {
                    currentDiff = DifficultyBand.Easy;
                }
            }

            // Invariant check across the entire chained sequence
            if (!_validator.ValidateChainedSequence(result))
            {
                throw new InvalidOperationException("Generated track sequence failed chained survivability validation!");
            }

            return result;
        }
    }
}
