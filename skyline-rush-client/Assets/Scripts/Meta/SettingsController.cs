using System;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    /// <summary>Which GDPR action is waiting on a parental gate token, mirroring game.js's closure-captured `doExport`/`doDelete` pending actions.</summary>
    public enum PendingGatedAction
    {
        None,
        DataExport,
        AccountDeletion
    }

    /// <summary>
    /// Pure C# state/logic class mirroring the web client's Settings & Privacy flow (web/game.js:
    /// openSettings, closeSettings, the audio sliders' oninput handlers, confirmAddFriend,
    /// handleDataExport, handleAccountDeletion). Not a MonoBehaviour — a future thin Canvas view
    /// calls into this and reads its state.
    ///
    /// Design note on scope (P3 item 12, AddFriendController): web/game.js treats "add friend" as
    /// a sub-flow launched from the Settings screen (btnOpenAddFriend / btnConfirmAddFriend are
    /// wired inside the same bindUI() block as the rest of Settings, and the add-friend modal is
    /// only reachable from Settings). It is small (one input field + one request) and has no
    /// standalone entry point elsewhere in the client, so its state/flow is folded into this
    /// class rather than a separate AddFriendController.cs, to avoid an extra near-empty file.
    ///
    /// Age bucket (CLAUDE.md #2): age bucketing is derived server-side. Unlike the web reference
    /// client's local debug age-bucket switcher (`.age-option-btn`, a testing convenience that
    /// re-labels the locally cached bucket), this controller exposes AgeBucket as a read-only
    /// value populated only from a server response (see SetAgeBucketFromServer) — it intentionally
    /// provides no method to let the client mutate its own age bucket.
    /// </summary>
    public class SettingsController
    {
        private readonly SkylineRushApiService _api;

        public bool IsVisible { get; private set; } = false;

        // --- Audio ---
        public int SfxVolumePercent { get; private set; } = 100;
        public int MusicVolumePercent { get; private set; } = 100;

        // --- Age bucket (server-derived, read-only) ---
        public string AgeBucket { get; private set; } = "16_plus";

        // --- Friend code / add-friend sub-flow ---
        public string MyFriendCode { get; private set; } = "SKY-RUNN";
        public bool IsAddFriendModalVisible { get; private set; } = false;
        public string AddFriendStatusMessage { get; private set; } = null;

        // --- GDPR ---
        public PendingGatedAction PendingAction { get; private set; } = PendingGatedAction.None;

        public event Action OnFriendAdded;
        public event Action<string> OnAddFriendFailed;
        public event Action<PendingGatedAction> OnParentalGateRequired;
        public event Action<PrivacyExportResponseDto> OnDataExported;
        public event Action<string> OnDataExportFailed;
        public event Action<PrivacyDeleteResponseDto> OnAccountDeleted;
        public event Action<string> OnAccountDeletionFailed;

        public SettingsController(SkylineRushApiService api)
        {
            _api = api;
        }

        public void Open() => IsVisible = true;
        public void Close() => IsVisible = false;

        public void SetSfxVolume(int percent) => SfxVolumePercent = Clamp0To100(percent);
        public void SetMusicVolume(int percent) => MusicVolumePercent = Clamp0To100(percent);

        private static int Clamp0To100(int value) => Math.Min(100, Math.Max(0, value));

        /// <summary>Called once after profile load. The client never invents or edits its own age bucket.</summary>
        public void SetAgeBucketFromServer(string ageBucket)
        {
            if (!string.IsNullOrEmpty(ageBucket)) AgeBucket = ageBucket;
        }

        /// <summary>Mirrors game.js's friend code derivation: `SKY-${(Api.playerId || 'RUNNER').substring(0,4).toUpperCase()}`.</summary>
        public void SetPlayerId(string playerId)
        {
            string source = string.IsNullOrEmpty(playerId) ? "RUNNER" : playerId;
            string prefix = source.Length >= 4 ? source.Substring(0, 4) : source.PadRight(4, '_');
            MyFriendCode = $"SKY-{prefix.ToUpperInvariant()}";
        }

        // --- Add-friend sub-flow ---

        public void OpenAddFriendModal()
        {
            IsAddFriendModalVisible = true;
            AddFriendStatusMessage = null;
        }

        public void CloseAddFriendModal()
        {
            IsAddFriendModalVisible = false;
        }

        /// <summary>Mirrors game.js's confirmAddFriend(). No idempotency key: /v1/friends/add has none in openapi.yaml.</summary>
        public async Task<bool> ConfirmAddFriendAsync(string code)
        {
            string trimmed = (code ?? "").Trim();
            if (string.IsNullOrEmpty(trimmed))
            {
                AddFriendStatusMessage = "ERROR: Please enter a valid friend code.";
                return false;
            }

            try
            {
                await _api.AddFriendAsync(trimmed);
                IsAddFriendModalVisible = false;
                AddFriendStatusMessage = null;
                OnFriendAdded?.Invoke();
                return true;
            }
            catch (ApiRequestException e)
            {
                AddFriendStatusMessage = $"ERROR: {e.Message}";
                OnAddFriendFailed?.Invoke(AddFriendStatusMessage);
                return false;
            }
        }

        // --- GDPR: Data export (Art. 15) ---

        /// <summary>Mirrors game.js's handleDataExport()'s age_bucket branch.</summary>
        public async Task RequestDataExportAsync()
        {
            if (AgeBucket == "under_13")
            {
                PendingAction = PendingGatedAction.DataExport;
                OnParentalGateRequired?.Invoke(PendingGatedAction.DataExport);
                return;
            }

            await CompleteDataExportAsync(null);
        }

        public async Task CompleteDataExportAsync(string parentalGateToken)
        {
            try
            {
                var response = await _api.ExportPrivacyDataAsync(
                    parentalGatePassed: parentalGateToken != null,
                    parentalGateToken: parentalGateToken);
                PendingAction = PendingGatedAction.None;
                OnDataExported?.Invoke(response);
            }
            catch (ApiRequestException e)
            {
                OnDataExportFailed?.Invoke(e.Message);
            }
        }

        // --- GDPR: Account deletion (Art. 17) ---

        /// <summary>
        /// Mirrors game.js's handleAccountDeletion(). The native "are you sure?" confirm dialog is
        /// a view-layer concern (Unity has no browser confirm()); pass the result of showing that
        /// prompt as <paramref name="userConfirmed"/>. Returns immediately without contacting the
        /// server if the user declined.
        /// </summary>
        public async Task RequestAccountDeletionAsync(bool userConfirmed)
        {
            if (!userConfirmed) return;

            if (AgeBucket == "under_13")
            {
                PendingAction = PendingGatedAction.AccountDeletion;
                OnParentalGateRequired?.Invoke(PendingGatedAction.AccountDeletion);
                return;
            }

            await CompleteAccountDeletionAsync(null);
        }

        public async Task CompleteAccountDeletionAsync(string parentalGateToken)
        {
            try
            {
                var response = await _api.DeletePrivacyDataAsync(
                    parentalGatePassed: parentalGateToken != null,
                    parentalGateToken: parentalGateToken);
                PendingAction = PendingGatedAction.None;
                OnAccountDeleted?.Invoke(response);
            }
            catch (ApiRequestException e)
            {
                OnAccountDeletionFailed?.Invoke(e.Message);
            }
        }

        /// <summary>Dispatch helper for a view that just received a parental_gate_token: resumes whichever GDPR action was pending.</summary>
        public async Task CompletePendingGatedActionAsync(string parentalGateToken)
        {
            switch (PendingAction)
            {
                case PendingGatedAction.DataExport:
                    await CompleteDataExportAsync(parentalGateToken);
                    break;
                case PendingGatedAction.AccountDeletion:
                    await CompleteAccountDeletionAsync(parentalGateToken);
                    break;
            }
        }
    }
}
