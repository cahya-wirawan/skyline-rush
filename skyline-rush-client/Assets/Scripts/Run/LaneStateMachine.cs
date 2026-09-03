using System;

namespace SkylineRush.Run
{
    public enum Lane
    {
        Left = -1,
        Center = 0,
        Right = 1
    }

    public class LaneStateMachine
    {
        public Lane CurrentLane { get; private set; } = Lane.Center;
        public Lane TargetLane { get; private set; } = Lane.Center;
        public bool IsChangingLane { get; private set; } = false;

        public float LaneWidth { get; set; } = 2.5f;
        public float TransitionDuration { get; set; } = 0.18f; // ~180ms fast lane change
        public float CurrentXPosition { get; private set; } = 0f;

        private float _transitionTimer = 0f;
        private float _startX = 0f;
        private float _targetX = 0f;

        public event Action<Lane, Lane> OnLaneChangeStarted;
        public event Action<Lane> OnLaneChangeCompleted;

        public bool TryChangeLane(int direction)
        {
            if (direction < 0 && TargetLane > Lane.Left)
            {
                SetTargetLane((Lane)((int)TargetLane - 1));
                return true;
            }
            if (direction > 0 && TargetLane < Lane.Right)
            {
                SetTargetLane((Lane)((int)TargetLane + 1));
                return true;
            }
            return false;
        }

        private void SetTargetLane(Lane newLane)
        {
            Lane fromLane = TargetLane;
            TargetLane = newLane;
            _startX = CurrentXPosition;
            _targetX = (int)newLane * LaneWidth;
            _transitionTimer = 0f;
            IsChangingLane = true;

            OnLaneChangeStarted?.Invoke(fromLane, newLane);
        }

        public void Update(float deltaTime)
        {
            if (!IsChangingLane)
            {
                CurrentXPosition = (int)CurrentLane * LaneWidth;
                return;
            }

            _transitionTimer += deltaTime;
            float t = Math.Min(1f, _transitionTimer / TransitionDuration);
            // Smooth ease out
            float ease = 1f - (1f - t) * (1f - t);
            CurrentXPosition = _startX + (_targetX - _startX) * ease;

            // When more than halfway, the runner has physically vacated the previous lane
            if (t >= 0.5f && CurrentLane != TargetLane)
            {
                CurrentLane = TargetLane;
            }

            if (t >= 1f)
            {
                IsChangingLane = false;
                CurrentLane = TargetLane;
                CurrentXPosition = _targetX;
                OnLaneChangeCompleted?.Invoke(CurrentLane);
            }
        }

        public void Reset()
        {
            CurrentLane = Lane.Center;
            TargetLane = Lane.Center;
            IsChangingLane = false;
            CurrentXPosition = 0f;
            _transitionTimer = 0f;
        }
    }
}
