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
        public int powerups_collected;
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
        public string run_id;
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
        public string sku;
    }

    // -----------------------------------------------------------------
    // Profile
    // -----------------------------------------------------------------

    [Serializable]
    public class EquippedDto
    {
        public string runner_id;
        public string board_id;
    }

    [Serializable]
    public class ProfileResponseDto
    {
        public string player_id;
        public string display_name;
        public string age_bucket;
        public EquippedDto equipped;
    }

    // -----------------------------------------------------------------
    // Leaderboard
    // -----------------------------------------------------------------

    [Serializable]
    public class LeaderboardItemDto
    {
        public int rank;
        public string player_id;
        public string display_name;
        public int meters;
    }

    [Serializable]
    public class SelfRankDto
    {
        public int rank;
        public int meters;
    }

    [Serializable]
    public class LeaderboardResponseDto
    {
        public LeaderboardItemDto[] items;
        public SelfRankDto self_rank;
        public string next_cursor;
        public bool empty_friends_prompt;
    }

    // -----------------------------------------------------------------
    // Supply Drops
    // -----------------------------------------------------------------

    [Serializable]
    public class SupplyDropTableEntryDto
    {
        public string reward;
        public float probability;
        public string item_type;
        public int min_amount;
        public int max_amount;
    }

    [Serializable]
    public class SupplyDropTableResponseDto
    {
        public string table_id;
        public int version;
        public SupplyDropTableEntryDto[] entries;
    }

    [Serializable]
    public class SupplyDropOpenRequestDto
    {
        public string acquired_via; // "earned" | "purchased"
        public string table_id;
    }

    [Serializable]
    public class SupplyDropOpenResultDto
    {
        public string reward;
        public int amount;
        public string item_type;
    }

    [Serializable]
    public class SupplyDropOpenResponseDto
    {
        public string open_id;
        public string table_id;
        public int table_version;
        public SupplyDropOpenResultDto result;
    }

    // -----------------------------------------------------------------
    // Contracts
    // -----------------------------------------------------------------

    [Serializable]
    public class ContractObjectiveDto
    {
        public string metric;
        public int target;
    }

    [Serializable]
    public class ContractRewardDto
    {
        public int chips;
        public int cores;
    }

    [Serializable]
    public class ContractItemDto
    {
        public string contract_id;
        public string type; // "daily" | "weekly_heist"
        public ContractObjectiveDto objective;
        public ContractRewardDto reward;
        public int progress;
        public int target;
        public bool completed;
        public bool claimed;
        public string active_from;
        public string active_to;
    }

    [Serializable]
    public class ActiveContractsResponseDto
    {
        public ContractItemDto[] daily;
        public ContractItemDto weekly_heist;
    }

    [Serializable]
    public class ClaimContractResponseDto
    {
        public string contract_id;
        public ContractRewardDto reward;
    }

    // -----------------------------------------------------------------
    // Roster
    // -----------------------------------------------------------------

    [Serializable]
    public class RosterItemDto
    {
        public string id;
        public string name;
        public bool owned;
        public bool equipped;
        public int unlock_cost_cores;
    }

    [Serializable]
    public class RosterResponseDto
    {
        public RosterItemDto[] runners;
        public RosterItemDto[] boards;
    }

    [Serializable]
    public class RosterEquipRequestDto
    {
        public string item_type; // "runner" | "board"
        public string item_id;
    }

    [Serializable]
    public class RosterEquipResponseDto
    {
        public bool ok;
    }

    [Serializable]
    public class RosterUnlockRequestDto
    {
        public string item_type; // "runner" | "board"
        public string item_id;
        public string method; // "cores"
    }

    [Serializable]
    public class RosterUnlockResponseDto
    {
        public bool ok;
        public BalanceResponseDto balance;
    }

    // -----------------------------------------------------------------
    // Parental Gate (client never computes/validates the answer itself —
    // it only relays the server-issued question and the user's typed digits)
    // -----------------------------------------------------------------

    [Serializable]
    public class ParentalGateChallengeResponseDto
    {
        public string challenge_id;
        public string question;
        public string challenge_token;
    }

    [Serializable]
    public class ParentalGateVerifyRequestDto
    {
        public string challenge_token;
        public int answer;
    }

    [Serializable]
    public class ParentalGateVerifyResponseDto
    {
        public string parental_gate_token;
        public int expires_in_seconds;
    }

    // -----------------------------------------------------------------
    // Friends
    // -----------------------------------------------------------------

    [Serializable]
    public class FriendAddRequestDto
    {
        public string method; // "friend_code"
        public string code;
    }

    [Serializable]
    public class FriendAddResponseDto
    {
        public bool ok;
    }

    // -----------------------------------------------------------------
    // Privacy (GDPR)
    // -----------------------------------------------------------------

    [Serializable]
    public class PrivacyExportRequestDto
    {
        public bool parental_gate_passed;
        public string parental_gate_token;
    }

    [Serializable]
    public class PrivacyExportResponseDto
    {
        public string tracking_id;
        public string status;
        public string download_url;
        // NOTE: openapi.yaml's `data` property is an untyped free-form object
        // (direct export payload for testing / immediate download). JsonUtility
        // cannot deserialize an arbitrary/dynamic object shape, so it is
        // intentionally omitted here; callers needing the raw payload should
        // parse HttpResponse.BodyJson directly for that field.
    }

    [Serializable]
    public class PrivacyDeleteRequestDto
    {
        public bool parental_gate_passed;
        public string parental_gate_token;
    }

    [Serializable]
    public class PrivacyDeleteResponseDto
    {
        public string status;
    }
}
