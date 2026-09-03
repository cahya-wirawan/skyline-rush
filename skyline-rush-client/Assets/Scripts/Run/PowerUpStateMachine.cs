using System;
using System.Collections.Generic;

namespace SkylineRush.Run
{
    public enum PowerUpType
    {
        Magnet,
        Shield,
        Boost,
        ChipMultiplier
    }

    public class ActivePowerUp
    {
        public PowerUpType Type { get; set; }
        public float RemainingDuration { get; set; }
        public float TotalDuration { get; set; }
        public int MultiplierValue { get; set; } = 1;
    }

    public class PowerUpStateMachine
    {
        public Dictionary<PowerUpType, ActivePowerUp> ActivePowerUps { get; } = new Dictionary<PowerUpType, ActivePowerUp>();

        public float DefaultMagnetDuration { get; set; } = 10f;
        public float DefaultShieldDuration { get; set; } = 15f;
        public float DefaultBoostDuration { get; set; } = 8f;
        public float DefaultChipMultiplierDuration { get; set; } = 12f;

        public event Action<PowerUpType> OnPowerUpActivated;
        public event Action<PowerUpType> OnPowerUpExpired;
        public event Action OnShieldAbsorbed;

        public bool IsShieldActive => ActivePowerUps.ContainsKey(PowerUpType.Shield);
        public bool IsMagnetActive => ActivePowerUps.ContainsKey(PowerUpType.Magnet);
        public bool IsBoostActive => ActivePowerUps.ContainsKey(PowerUpType.Boost);
        public bool IsChipMultiplierActive => ActivePowerUps.ContainsKey(PowerUpType.ChipMultiplier);

        public int CurrentChipMultiplier
        {
            get
            {
                if (ActivePowerUps.TryGetValue(PowerUpType.ChipMultiplier, out var active))
                {
                    return active.MultiplierValue;
                }
                return 1;
            }
        }

        public void ActivatePowerUp(PowerUpType type, float customDuration = -1f)
        {
            float duration = customDuration > 0 ? customDuration : GetDefaultDuration(type);

            if (type == PowerUpType.Shield)
            {
                // AC-004: Given a Shield is already active, when the player collects another Shield,
                // then no second Shield stacks (duration does not extend beyond the single active instance's
                // remaining time, per the documented non-stacking rule).
                if (ActivePowerUps.ContainsKey(PowerUpType.Shield))
                {
                    // Non-stacking: ignore pickup, retain existing remaining duration
                    return;
                }

                ActivePowerUps[PowerUpType.Shield] = new ActivePowerUp
                {
                    Type = PowerUpType.Shield,
                    RemainingDuration = duration,
                    TotalDuration = duration
                };
                OnPowerUpActivated?.Invoke(PowerUpType.Shield);
                return;
            }

            if (type == PowerUpType.ChipMultiplier)
            {
                // Timer refreshes for Chip Multiplier
                ActivePowerUps[PowerUpType.ChipMultiplier] = new ActivePowerUp
                {
                    Type = PowerUpType.ChipMultiplier,
                    RemainingDuration = duration,
                    TotalDuration = duration,
                    MultiplierValue = 2 // 2x multiplier
                };
                OnPowerUpActivated?.Invoke(PowerUpType.ChipMultiplier);
                return;
            }

            // Magnet / Boost refresh timer
            ActivePowerUps[type] = new ActivePowerUp
            {
                Type = type,
                RemainingDuration = duration,
                TotalDuration = duration
            };
            OnPowerUpActivated?.Invoke(type);
        }

        public bool TryAbsorbHitWithShield()
        {
            if (IsShieldActive)
            {
                ActivePowerUps.Remove(PowerUpType.Shield);
                OnShieldAbsorbed?.Invoke();
                return true; // Hit absorbed!
            }
            if (IsBoostActive)
            {
                // Boost has invincibility against obstacle hits
                return true;
            }
            return false;
        }

        public int CalculateCollectedChips(int baseChipValue)
        {
            // AC-004: Given a Chip Multiplier is active, when the player collects Chips,
            // then the credited amount is exactly the base value times the active multiplier,
            // with no rounding loss below the true integer value.
            return baseChipValue * CurrentChipMultiplier;
        }

        public void Update(float deltaTime)
        {
            var expired = new List<PowerUpType>();

            foreach (var kvp in ActivePowerUps)
            {
                kvp.Value.RemainingDuration -= deltaTime;
                if (kvp.Value.RemainingDuration <= 0f)
                {
                    expired.Add(kvp.Key);
                }
            }

            foreach (var type in expired)
            {
                ActivePowerUps.Remove(type);
                OnPowerUpExpired?.Invoke(type);
            }
        }

        public void Reset()
        {
            ActivePowerUps.Clear();
        }

        private float GetDefaultDuration(PowerUpType type)
        {
            switch (type)
            {
                case PowerUpType.Magnet: return DefaultMagnetDuration;
                case PowerUpType.Shield: return DefaultShieldDuration;
                case PowerUpType.Boost: return DefaultBoostDuration;
                case PowerUpType.ChipMultiplier: return DefaultChipMultiplierDuration;
                default: return 10f;
            }
        }
    }
}
