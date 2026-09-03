using System;

namespace SkylineRush.Run
{
    public enum VerticalState
    {
        Running,
        Jumping,
        Sliding
    }

    public class JumpSlideController
    {
        public VerticalState State { get; private set; } = VerticalState.Running;
        public float JumpDuration { get; set; } = 0.65f;
        public float SlideDuration { get; set; } = 0.60f;
        public float MaxJumpHeight { get; set; } = 2.2f;

        public float CurrentYPosition { get; private set; } = 0f;
        public bool IsColliderReducedForSlide => State == VerticalState.Sliding;
        public bool IsAirborne => State == VerticalState.Jumping;

        private float _stateTimer = 0f;
        private bool _queuedSlideOnLanding = false;

        public event Action OnJumpStarted;
        public event Action OnSlideStarted;
        public event Action OnReturnedToRun;

        public void Jump()
        {
            if (State == VerticalState.Running || State == VerticalState.Sliding)
            {
                State = VerticalState.Jumping;
                _stateTimer = 0f;
                _queuedSlideOnLanding = false;
                OnJumpStarted?.Invoke();
            }
        }

        public void Slide()
        {
            if (State == VerticalState.Running)
            {
                State = VerticalState.Sliding;
                _stateTimer = 0f;
                CurrentYPosition = 0f;
                OnSlideStarted?.Invoke();
            }
            else if (State == VerticalState.Jumping)
            {
                // AC-001: Given a player is mid-air from a jump, when they swipe down,
                // then the character begins a slide immediately on landing rather than queuing a second jump.
                // Fast-fall down to land quickly into slide
                _queuedSlideOnLanding = true;
                _stateTimer = Math.Max(_stateTimer, JumpDuration * 0.75f);
            }
        }

        public void Update(float deltaTime)
        {
            if (State == VerticalState.Jumping)
            {
                _stateTimer += deltaTime;
                float progress = _stateTimer / JumpDuration;

                if (progress >= 1f)
                {
                    CurrentYPosition = 0f;
                    if (_queuedSlideOnLanding)
                    {
                        _queuedSlideOnLanding = false;
                        State = VerticalState.Sliding;
                        _stateTimer = 0f;
                        OnSlideStarted?.Invoke();
                    }
                    else
                    {
                        State = VerticalState.Running;
                        OnReturnedToRun?.Invoke();
                    }
                }
                else
                {
                    // Parabolic jump arc: y = 4 * H * p * (1 - p)
                    CurrentYPosition = 4f * MaxJumpHeight * progress * (1f - progress);
                }
            }
            else if (State == VerticalState.Sliding)
            {
                _stateTimer += deltaTime;
                CurrentYPosition = 0f;

                if (_stateTimer >= SlideDuration)
                {
                    State = VerticalState.Running;
                    OnReturnedToRun?.Invoke();
                }
            }
            else
            {
                CurrentYPosition = 0f;
            }
        }

        public void Reset()
        {
            State = VerticalState.Running;
            _stateTimer = 0f;
            CurrentYPosition = 0f;
            _queuedSlideOnLanding = false;
        }
    }
}
