using System;

namespace SkylineRush.Networking
{
    [Serializable]
    public class AuthGuestRequestDto
    {
        public string guest_device_id;
        public string age_bucket;
    }

    [Serializable]
    public class AuthResponseDto
    {
        public string player_id;
        public string access_token;
        public string refresh_token;
        public string age_bucket;
    }

    [Serializable]
    public class RunSubmitRequestDto
    {
        public string district_id;
        public string runner_id;
        public string board_id;
        public int meters;
        public int chips_collected;
        public string crashed_cause;
        public string client_submitted_at;
        public float duration_seconds;
    }

    [Serializable]
    public class RunSubmitResponseDto
    {
        public string run_id;
        public string integrity_flag;
        public RewardsDto rewards;
        public bool new_district_best;
    }

    [Serializable]
    public class RewardsDto
    {
        public int chips_granted;
        public int cores_granted;
        public int pass_xp_granted;
    }

    [Serializable]
    public class RedeployRequestDto
    {
        public string method;
        public string ad_receipt;
    }

    [Serializable]
    public class RedeployResponseDto
    {
        public int cores_spent;
        public int cores_remaining;
    }

    [Serializable]
    public class BalanceResponseDto
    {
        public int chips;
        public int cores;
    }

    [Serializable]
    public class PurchaseReceiptRequestDto
    {
        public string sku;
        public string transaction_id;
        public string signed_transaction;
        public bool parental_gate_passed;
        public string parental_gate_token;
    }

    [Serializable]
    public class PurchaseReceiptResponseDto
    {
        public string status;
        public EntitlementDto entitlement;
    }

    [Serializable]
    public class EntitlementDto
    {
        public int chips;
        public int cores;
        public string non_consumable;
    }
}
