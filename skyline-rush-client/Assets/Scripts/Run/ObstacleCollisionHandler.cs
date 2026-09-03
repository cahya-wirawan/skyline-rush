using System;

namespace SkylineRush.Run
{
    public enum ObstacleType
    {
        LowBarrier,   // Can jump over
        HighBarrier,  // Can slide under
        FullBlocker   // Must switch lane
    }

    public struct Obstacle
    {
        public Lane ObstacleLane;
        public float ZPosition;
        public ObstacleType Type;
        public float Depth;
        public float Width;

        public float XPosition => (int)ObstacleLane * 2.5f;

        public Obstacle(Lane lane, float z, ObstacleType type, float depth = 1.0f, float width = 2.0f)
        {
            ObstacleLane = lane;
            ZPosition = z;
            Type = type;
            Depth = depth;
            Width = width;
        }
    }

    public class ObstacleCollisionHandler
    {
        public float LaneWidth { get; set; } = 2.5f;
        public float RunnerWidth { get; set; } = 0.8f;
        public float DefaultObstacleWidth { get; set; } = 2.0f;
        public float CollisionDepthThreshold { get; set; } = 1.0f;

        // CRIT-07: Continuous X coordinate checking with bounding box overlap
        public bool CheckCollision(
            Obstacle obstacle,
            float runnerX,
            float runnerZ,
            VerticalState verticalState,
            float runnerY,
            bool isChangingLane,
            Lane targetLane,
            float runnerWidth = 0.8f,
            float obstacleWidth = 2.0f)
        {
            // 1. Check longitudinal (Z) bounding box overlap
            float halfObsDepth = obstacle.Depth / 2f;
            float halfRunnerDepth = CollisionDepthThreshold / 2f;
            float zDiff = Math.Abs(obstacle.ZPosition - runnerZ);
            if (zDiff > (halfObsDepth + halfRunnerDepth))
            {
                return false; // Not overlapping on Z axis
            }

            // 2. Check lateral (X) continuous bounding box overlap
            float obstacleX = (int)obstacle.ObstacleLane * LaneWidth;
            float obsW = obstacle.Width > 0 ? obstacle.Width : obstacleWidth;
            float halfObsWidth = obsW / 2f;
            float halfRunnerWidth = runnerWidth / 2f;
            float xDiff = Math.Abs(runnerX - obstacleX);

            if (xDiff >= (halfObsWidth + halfRunnerWidth))
            {
                return false; // Continuous bounding boxes do not overlap in X
            }

            // 3. Vacated lane immunity (AC-001):
            // If the runner is changing lane towards targetLane and obstacle is in the vacated lane,
            // moving towards targetLane provides immediate immunity from the vacated lane obstacle
            if (isChangingLane && obstacle.ObstacleLane != targetLane)
            {
                float targetX = (int)targetLane * LaneWidth;
                bool movingTowardsTarget = (targetX > obstacleX && runnerX > obstacleX) || (targetX < obstacleX && runnerX < obstacleX);
                if (movingTowardsTarget || xDiff > halfObsWidth)
                {
                    return false;
                }
            }

            // 4. Check vertical avoidance based on obstacle type
            switch (obstacle.Type)
            {
                case ObstacleType.LowBarrier:
                    // Avoided if jumping high enough
                    if (verticalState == VerticalState.Jumping && runnerY > 0.9f)
                    {
                        return false;
                    }
                    return true;

                case ObstacleType.HighBarrier:
                    // Avoided if sliding
                    if (verticalState == VerticalState.Sliding)
                    {
                        return false;
                    }
                    return true;

                case ObstacleType.FullBlocker:
                    // Cannot jump or slide over
                    return true;

                default:
                    return true;
            }
        }

        // Discrete overload for backward compatibility
        public bool CheckCollision(
            Obstacle obstacle,
            Lane runnerLane,
            float runnerZ,
            VerticalState verticalState,
            float runnerY,
            bool isChangingLane,
            Lane targetLane)
        {
            float runnerX = (int)runnerLane * LaneWidth;
            return CheckCollision(obstacle, runnerX, runnerZ, verticalState, runnerY, isChangingLane, targetLane);
        }
    }
}
