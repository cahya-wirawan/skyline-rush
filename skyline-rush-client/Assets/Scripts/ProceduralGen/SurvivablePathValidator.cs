using System;
using System.Collections.Generic;
using SkylineRush.Run;

namespace SkylineRush.ProceduralGen
{
    public class SurvivablePathValidator
    {
        public float RunSpeed { get; set; } = 12.0f; // 12 m/s forward speed
        public float JumpDuration { get; set; } = 0.65f;
        public float SlideDuration { get; set; } = 0.60f;
        public float MaxJumpHeight { get; set; } = 2.2f;

        public struct TrajectoryNode
        {
            public float Z;
            public Lane CurrentLane;
            public VerticalState Vertical;
            public float VerticalTimer;
            public bool QueuedSlide;

            public TrajectoryNode(float z, Lane lane, VerticalState vertical, float timer, bool queuedSlide = false)
            {
                Z = z;
                CurrentLane = lane;
                Vertical = vertical;
                VerticalTimer = timer;
                QueuedSlide = queuedSlide;
            }
        }

        public bool HasSurvivablePath(TrackSegment segment, float stepSize = 1.0f)
        {
            // Try starting from each valid entry lane
            bool survivableFromAnyEntry = false;

            Lane[] lanes = { Lane.Left, Lane.Center, Lane.Right };
            foreach (var startLane in lanes)
            {
                LaneMask mask = GetLaneMask(startLane);
                if ((segment.ValidEntryLanes & mask) == 0) continue;

                if (SearchPath(segment, startLane, stepSize))
                {
                    survivableFromAnyEntry = true;
                    break;
                }
            }

            return survivableFromAnyEntry;
        }

        public bool ValidateChainedSequence(List<TrackSegment> sequence, float stepSize = 1.0f)
        {
            if (sequence == null || sequence.Count == 0) return true;

            // Check entry/exit lane compatibility between adjacent segments
            for (int i = 0; i < sequence.Count - 1; i++)
            {
                var current = sequence[i];
                var next = sequence[i + 1];

                if ((current.ValidExitLanes & next.ValidEntryLanes) == 0)
                {
                    return false; // Exit of current does not match Entry of next!
                }
            }

            // Validate each segment internally
            foreach (var seg in sequence)
            {
                if (!HasSurvivablePath(seg, stepSize))
                {
                    return false;
                }
            }

            return true;
        }

        private bool SearchPath(TrackSegment segment, Lane startLane, float stepSize)
        {
            var queue = new Queue<TrajectoryNode>();
            var visited = new HashSet<string>();

            queue.Enqueue(new TrajectoryNode(0f, startLane, VerticalState.Running, 0f, false));

            float dt = stepSize / RunSpeed;

            while (queue.Count > 0)
            {
                var current = queue.Dequeue();

                // Reached exit!
                if (current.Z >= segment.LengthMeters)
                {
                    LaneMask exitMask = GetLaneMask(current.CurrentLane);
                    if ((segment.ValidExitLanes & exitMask) != 0)
                    {
                        return true; // Found survivable path to valid exit lane!
                    }
                    continue;
                }

                int zStep = (int)Math.Round(current.Z / stepSize);
                int timerStep = (int)Math.Round(current.VerticalTimer / 0.15f);
                string stateKey = $"{zStep}:{(int)current.CurrentLane}:{(int)current.Vertical}:{timerStep}:{(current.QueuedSlide ? 1 : 0)}";
                if (visited.Contains(stateKey)) continue;
                visited.Add(stateKey);

                float nextZ = current.Z + stepSize;

                // Candidate next lanes: stay or change by 1 lane
                var candidateLanes = new List<Lane> { current.CurrentLane };
                if (current.CurrentLane > Lane.Left) candidateLanes.Add((Lane)((int)current.CurrentLane - 1));
                if (current.CurrentLane < Lane.Right) candidateLanes.Add((Lane)((int)current.CurrentLane + 1));

                // CRIT-06: Compute candidate vertical states based on realistic physics durations
                var candidateVerticals = new List<(VerticalState state, float timer, float y, bool queuedSlide)>();

                if (current.Vertical == VerticalState.Running)
                {
                    // 1. Continue running
                    candidateVerticals.Add((VerticalState.Running, 0f, 0f, false));

                    // 2. Initiate jump
                    float jumpT = dt;
                    float progress = jumpT / JumpDuration;
                    float jumpY = 4f * MaxJumpHeight * progress * (1f - progress);
                    candidateVerticals.Add((VerticalState.Jumping, jumpT, jumpY, false));

                    // 3. Initiate slide
                    candidateVerticals.Add((VerticalState.Sliding, dt, 0f, false));
                }
                else if (current.Vertical == VerticalState.Jumping)
                {
                    // A. Continue natural jump progression
                    float naturalT = current.VerticalTimer + dt;
                    if (naturalT >= JumpDuration)
                    {
                        if (current.QueuedSlide)
                        {
                            candidateVerticals.Add((VerticalState.Sliding, 0f, 0f, false));
                        }
                        else
                        {
                            candidateVerticals.Add((VerticalState.Running, 0f, 0f, false));
                        }
                    }
                    else
                    {
                        float progress = naturalT / JumpDuration;
                        float jumpY = 4f * MaxJumpHeight * progress * (1f - progress);
                        candidateVerticals.Add((VerticalState.Jumping, naturalT, jumpY, current.QueuedSlide));
                    }

                    // B. Fast-fall mid-air swipe down into slide queue
                    float fastT = Math.Max(current.VerticalTimer, JumpDuration * 0.75f) + dt;
                    if (fastT >= JumpDuration)
                    {
                        candidateVerticals.Add((VerticalState.Sliding, 0f, 0f, false));
                    }
                    else
                    {
                        float progress = fastT / JumpDuration;
                        float jumpY = 4f * MaxJumpHeight * progress * (1f - progress);
                        candidateVerticals.Add((VerticalState.Jumping, fastT, jumpY, true));
                    }
                }
                else if (current.Vertical == VerticalState.Sliding)
                {
                    // Must remain sliding until slide duration completes
                    float slideT = current.VerticalTimer + dt;
                    if (slideT >= SlideDuration)
                    {
                        candidateVerticals.Add((VerticalState.Running, 0f, 0f, false));
                    }
                    else
                    {
                        candidateVerticals.Add((VerticalState.Sliding, slideT, 0f, false));
                    }
                }

                foreach (var nextLane in candidateLanes)
                {
                    foreach (var v in candidateVerticals)
                    {
                        if (segment.IsLaneAvailableAtZ(nextLane, nextZ, v.state, v.y))
                        {
                            queue.Enqueue(new TrajectoryNode(nextZ, nextLane, v.state, v.timer, v.queuedSlide));
                        }
                    }
                }
            }

            return false; // No path survived to exit
        }

        private LaneMask GetLaneMask(Lane lane)
        {
            switch (lane)
            {
                case Lane.Left: return LaneMask.Left;
                case Lane.Center: return LaneMask.Center;
                case Lane.Right: return LaneMask.Right;
                default: return LaneMask.None;
            }
        }
    }
}
