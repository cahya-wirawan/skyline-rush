using System;
using System.Collections.Generic;

namespace SkylineRush.Run
{
    public enum RunState
    {
        Active,
        Crashed,
        Redeploying,
        Completed
    }

    public class RunSession
    {
        public LaneStateMachine LaneMachine { get; } = new LaneStateMachine();
        public InputBuffer Input { get; } = new InputBuffer();
        public JumpSlideController JumpSlide { get; } = new JumpSlideController();
        public PowerUpStateMachine PowerUps { get; } = new PowerUpStateMachine();
        public ObstacleCollisionHandler Collisions { get; } = new ObstacleCollisionHandler();

        public RunState State { get; private set; } = RunState.Active;
        public float BaseSpeed { get; set; } = 12.0f; // 12 m/s base speed
        public float DistanceMeters { get; private set; } = 0f;
        public int ChipsCollected { get; private set; } = 0;
        public int Score => (int)DistanceMeters + ChipsCollected;

        public int CoreRedeployCount { get; private set; } = 0;
        public bool AdRedeployUsed { get; private set; } = false;

        public float InvincibilityRemaining { get; private set; } = 0f;
        public string LastCrashCause { get; private set; } = null;

        public event Action<string> OnRunCrashed;
        public event Action OnRunResumed;
        public event Action OnRunCompleted;

        public void StartRun()
        {
            State = RunState.Active;
            DistanceMeters = 0f;
            ChipsCollected = 0;
            CoreRedeployCount = 0;
            AdRedeployUsed = false;
            InvincibilityRemaining = 0f;
            LastCrashCause = null;
            LaneMachine.Reset();
            Input.Clear();
            JumpSlide.Reset();
            PowerUps.Reset();
        }

        public void Update(float deltaTime)
        {
            if (State != RunState.Active) return;

            // 1. Process Input
            Input.Update(deltaTime);
            if (Input.HasInput)
            {
                InputAction action = Input.ConsumeInput();
                switch (action)
                {
                    case InputAction.SwipeLeft:
                        LaneMachine.TryChangeLane(-1);
                        break;
                    case InputAction.SwipeRight:
                        LaneMachine.TryChangeLane(1);
                        break;
                    case InputAction.SwipeUp:
                        JumpSlide.Jump();
                        break;
                    case InputAction.SwipeDown:
                        JumpSlide.Slide();
                        break;
                }
            }

            // 2. Update sub-controllers
            LaneMachine.Update(deltaTime);
            JumpSlide.Update(deltaTime);
            PowerUps.Update(deltaTime);

            if (InvincibilityRemaining > 0f)
            {
                InvincibilityRemaining -= deltaTime;
            }

            // 3. Advance distance
            float speed = BaseSpeed;
            if (PowerUps.IsBoostActive)
            {
                speed *= 1.8f; // Boost speed multiplier
            }
            DistanceMeters += speed * deltaTime;
        }

        public void CollectChips(int baseValue)
        {
            int credited = PowerUps.CalculateCollectedChips(baseValue);
            ChipsCollected += credited;
        }

        public void CheckObstacle(Obstacle obstacle)
        {
            if (State != RunState.Active) return;
            if (InvincibilityRemaining > 0f) return;

            bool hit = Collisions.CheckCollision(
                obstacle,
                LaneMachine.CurrentXPosition,
                DistanceMeters,
                JumpSlide.State,
                JumpSlide.CurrentYPosition,
                LaneMachine.IsChangingLane,
                LaneMachine.TargetLane
            );

            if (hit)
            {
                // Check if Shield absorbs
                if (PowerUps.TryAbsorbHitWithShield())
                {
                    // Shield absorbed hit! Runner continues unharmed with brief recovery i-frames
                    InvincibilityRemaining = 1.0f;
                    return;
                }

                // Crash!
                Crash("obstacle_hit");
            }
        }

        public void Crash(string cause)
        {
            State = RunState.Crashed;
            LastCrashCause = cause;
            OnRunCrashed?.Invoke(cause);
        }

        public int GetNextCoreRedeployCost()
        {
            // AC-002: escalating cost (10 -> 20 -> 40, capped at 40)
            if (CoreRedeployCount == 0) return 10;
            if (CoreRedeployCount == 1) return 20;
            return 40;
        }

        public bool TryRedeployViaAd()
        {
            if (State != RunState.Crashed || AdRedeployUsed)
            {
                return false;
            }

            AdRedeployUsed = true;
            ResumeAfterRedeploy();
            return true;
        }

        public bool TryRedeployViaCores(int currentCoreBalance, out int costSpent, out int shortfall)
        {
            costSpent = 0;
            shortfall = 0;

            if (State != RunState.Crashed)
            {
                return false;
            }

            int requiredCost = GetNextCoreRedeployCost();
            if (currentCoreBalance < requiredCost)
            {
                shortfall = requiredCost - currentCoreBalance;
                return false;
            }

            costSpent = requiredCost;
            CoreRedeployCount++;
            ResumeAfterRedeploy();
            return true;
        }

        private void ResumeAfterRedeploy()
        {
            State = RunState.Active;
            InvincibilityRemaining = 2.0f; // 2 seconds safety window on revive
            JumpSlide.Reset();
            OnRunResumed?.Invoke();
        }

        public void EndRun()
        {
            State = RunState.Completed;
            OnRunCompleted?.Invoke();
        }
    }
}
