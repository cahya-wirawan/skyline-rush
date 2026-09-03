using System;
using System.Collections.Generic;
using SkylineRush.Run;

namespace SkylineRush.ProceduralGen
{
    [Flags]
    public enum LaneMask
    {
        None = 0,
        Left = 1 << 0,
        Center = 1 << 1,
        Right = 1 << 2,
        All = Left | Center | Right
    }

    public enum DifficultyBand
    {
        BreathingRoom = 0,
        Easy = 1,
        Medium = 2,
        Hard = 3,
        Maximum = 4
    }

    public class TrackSegment
    {
        public string SegmentId { get; set; }
        public float LengthMeters { get; set; } = 30.0f;
        public DifficultyBand Difficulty { get; set; } = DifficultyBand.Easy;
        public LaneMask ValidEntryLanes { get; set; } = LaneMask.All;
        public LaneMask ValidExitLanes { get; set; } = LaneMask.All;
        public List<Obstacle> Obstacles { get; set; } = new List<Obstacle>();

        public TrackSegment(string id, DifficultyBand difficulty, float length = 30.0f)
        {
            SegmentId = id;
            Difficulty = difficulty;
            LengthMeters = length;
        }

        public bool IsLaneAvailableAtZ(Lane lane, float localZ, VerticalState state, float runnerY)
        {
            foreach (var obs in Obstacles)
            {
                if (obs.ObstacleLane == lane && Math.Abs(obs.ZPosition - localZ) <= (obs.Depth / 2f + 0.5f))
                {
                    // Check if obstacle blocks this vertical state
                    if (obs.Type == ObstacleType.LowBarrier && state == VerticalState.Jumping && runnerY > 1.0f)
                        continue;
                    if (obs.Type == ObstacleType.HighBarrier && state == VerticalState.Sliding)
                        continue;

                    return false; // Blocked!
                }
            }
            return true;
        }
    }
}
