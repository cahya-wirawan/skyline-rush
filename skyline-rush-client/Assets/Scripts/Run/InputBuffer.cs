using System;

namespace SkylineRush.Run
{
    public enum InputAction
    {
        None,
        SwipeLeft,
        SwipeRight,
        SwipeUp,    // Jump
        SwipeDown   // Slide
    }

    public class InputBuffer
    {
        public float BufferWindowSeconds { get; set; } = 0.15f; // 150ms buffer window
        public InputAction BufferedAction { get; private set; } = InputAction.None;
        private float _timeRemaining = 0f;

        public void RegisterInput(InputAction action)
        {
            if (action == InputAction.None) return;
            BufferedAction = action;
            _timeRemaining = BufferWindowSeconds;
        }

        public void Update(float deltaTime)
        {
            if (BufferedAction != InputAction.None)
            {
                _timeRemaining -= deltaTime;
                if (_timeRemaining <= 0f)
                {
                    BufferedAction = InputAction.None;
                }
            }
        }

        public InputAction ConsumeInput()
        {
            InputAction action = BufferedAction;
            BufferedAction = InputAction.None;
            _timeRemaining = 0f;
            return action;
        }

        public bool HasInput => BufferedAction != InputAction.None;

        public void Clear()
        {
            BufferedAction = InputAction.None;
            _timeRemaining = 0f;
        }
    }
}
