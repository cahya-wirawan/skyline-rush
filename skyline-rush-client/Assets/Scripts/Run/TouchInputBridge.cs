using UnityEngine;

namespace SkylineRush.Run
{
    /// <summary>
    /// Bridges raw device input (touch swipes + keyboard) into <see cref="RunSession"/>'s
    /// <see cref="InputBuffer"/> via RegisterInput(...), mirroring the control scheme implemented
    /// by the reference web client (web/game.js bindControls() + web/index.html's controls-hint):
    /// - A / Left Arrow  -> SwipeLeft (lane change left)
    /// - D / Right Arrow -> SwipeRight (lane change right)
    /// - W / Space / Up Arrow -> SwipeUp (jump)
    /// - S / Down Arrow  -> SwipeDown (slide)
    /// - Touch swipe (finger drag past <see cref="swipeThresholdPixels"/>): horizontal drag maps
    ///   to lane change, vertical drag maps to jump (up) or slide (down) — same axis-dominance
    ///   logic as the web client's touchend handler (compares abs(dx) vs abs(dy)).
    ///
    /// This uses Unity's legacy Input class (Input.touches / Input.GetKeyDown) rather than the
    /// new Input System's InputAction assets. The project depends on com.unity.inputsystem
    /// (see Packages/manifest.json) but no .inputactions asset exists yet — those require the
    /// Editor to author, and no Editor has ever opened this project. Legacy Input requires no
    /// asset files and is guaranteed to compile; once a Scene/Input Actions asset pass happens,
    /// this class can be swapped for the new system without touching RunSession or InputBuffer.
    ///
    /// Expected GameObject/Inspector wiring (once a Scene exists):
    /// - Attach to the same GameObject as RunLoopDriver (or any persistent object that can see it).
    /// - Assign <see cref="runLoopDriver"/> to that RunLoopDriver component so this bridge can
    ///   reach the live RunSession.Input buffer each frame.
    /// </summary>
    public class TouchInputBridge : MonoBehaviour
    {
        [Header("Session Reference")]
        [SerializeField] private RunLoopDriver runLoopDriver;

        [Header("Touch Tuning")]
        [Tooltip("Minimum finger travel, in screen pixels, before a touch drag counts as a swipe.")]
        [SerializeField] private float swipeThresholdPixels = 50f;

        private bool _isTracking = false;
        private Vector2 _touchStartPosition;

        private void Update()
        {
            if (runLoopDriver == null || runLoopDriver.Session == null) return;

            HandleKeyboard();
            HandleTouch();
        }

        private void HandleKeyboard()
        {
            var input = runLoopDriver.Session.Input;

            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A))
            {
                input.RegisterInput(InputAction.SwipeLeft);
            }
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D))
            {
                input.RegisterInput(InputAction.SwipeRight);
            }
            if (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.Space))
            {
                input.RegisterInput(InputAction.SwipeUp);
            }
            if (Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S))
            {
                input.RegisterInput(InputAction.SwipeDown);
            }
        }

        private void HandleTouch()
        {
            if (Input.touchCount == 0)
            {
                _isTracking = false;
                return;
            }

            Touch touch = Input.GetTouch(0);

            switch (touch.phase)
            {
                case TouchPhase.Began:
                    _touchStartPosition = touch.position;
                    _isTracking = true;
                    break;

                case TouchPhase.Ended:
                case TouchPhase.Canceled:
                    if (_isTracking)
                    {
                        EvaluateSwipe(touch.position);
                    }
                    _isTracking = false;
                    break;
            }
        }

        private void EvaluateSwipe(Vector2 endPosition)
        {
            Vector2 delta = endPosition - _touchStartPosition;
            float absX = Mathf.Abs(delta.x);
            float absY = Mathf.Abs(delta.y);

            if (Mathf.Max(absX, absY) < swipeThresholdPixels) return;

            var input = runLoopDriver.Session.Input;

            if (absX > absY)
            {
                input.RegisterInput(delta.x > 0 ? InputAction.SwipeRight : InputAction.SwipeLeft);
            }
            else
            {
                // Screen space: positive Y delta means the finger moved up the screen.
                input.RegisterInput(delta.y > 0 ? InputAction.SwipeUp : InputAction.SwipeDown);
            }
        }
    }
}
