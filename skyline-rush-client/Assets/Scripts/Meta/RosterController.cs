using System;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    public enum RosterTab
    {
        Runners,
        Boards
    }

    /// <summary>
    /// Pure C# state/logic class mirroring the web client's Roster & Customization flow
    /// (web/game.js: openRoster, closeRoster, selectRosterTab, renderRosterTab, equipItem,
    /// unlockItem). Not a MonoBehaviour — a future thin Canvas view calls into this and reads its
    /// state/events.
    ///
    /// CLAUDE.md #1: the client never grants roster unlocks itself. UnlockAsync only *initiates*
    /// the request via SkylineRushApiService.UnlockRosterItemAsync (POST /v1/roster/unlock, which
    /// is server-side row-locked and atomic); this controller never flips a local "owned" flag —
    /// it always re-fetches the catalog from the server afterward (matching game.js's
    /// renderRosterTab() re-fetch pattern) so the displayed state is always server-truth.
    /// </summary>
    public class RosterController
    {
        private readonly SkylineRushApiService _api;

        public bool IsVisible { get; private set; } = false;
        public RosterTab ActiveTab { get; private set; } = RosterTab.Runners;
        public bool IsLoading { get; private set; } = false;
        public string ErrorMessage { get; private set; } = null;

        public RosterItemDto[] Runners { get; private set; } = Array.Empty<RosterItemDto>();
        public RosterItemDto[] Boards { get; private set; } = Array.Empty<RosterItemDto>();

        /// <summary>Items for whichever tab is currently active — what a view should render.</summary>
        public RosterItemDto[] ActiveTabItems => ActiveTab == RosterTab.Runners ? Runners : Boards;

        public event Action OnRosterRefreshed;
        public event Action<string> OnLoadFailed;
        public event Action<string, string> OnEquipped; // (itemType, itemId)
        public event Action<string> OnEquipFailed;
        public event Action<string, string> OnUnlocked; // (itemType, itemId)
        public event Action<string> OnUnlockFailed;

        public RosterController(SkylineRushApiService api)
        {
            _api = api;
        }

        /// <summary>Mirrors game.js's openRoster(): shows the modal and loads the current tab.</summary>
        public async Task OpenAsync()
        {
            IsVisible = true;
            await RefreshAsync();
        }

        public void Close()
        {
            IsVisible = false;
        }

        /// <summary>Mirrors game.js's selectRosterTab(tab), which re-renders (and re-fetches) after switching.</summary>
        public async Task SelectTabAsync(RosterTab tab)
        {
            ActiveTab = tab;
            await RefreshAsync();
        }

        /// <summary>Mirrors game.js's renderRosterTab()'s Api.getRoster() call.</summary>
        public async Task RefreshAsync()
        {
            IsLoading = true;
            ErrorMessage = null;
            try
            {
                var roster = await _api.GetRosterAsync();
                Runners = roster.runners ?? Array.Empty<RosterItemDto>();
                Boards = roster.boards ?? Array.Empty<RosterItemDto>();
                OnRosterRefreshed?.Invoke();
            }
            catch (ApiRequestException e)
            {
                ErrorMessage = "Could not load roster catalog.";
                OnLoadFailed?.Invoke(e.Message);
            }
            finally
            {
                IsLoading = false;
            }
        }

        private static string TypeString(RosterTab tab) => tab == RosterTab.Runners ? "runner" : "board";

        /// <summary>Mirrors game.js's equipItem(type, id).</summary>
        public async Task EquipAsync(RosterTab tab, string itemId)
        {
            string itemType = TypeString(tab);
            try
            {
                await _api.EquipRosterItemAsync(itemType, itemId);
                OnEquipped?.Invoke(itemType, itemId);
                await RefreshAsync();
            }
            catch (ApiRequestException e)
            {
                OnEquipFailed?.Invoke(e.Message);
            }
        }

        /// <summary>Mirrors game.js's unlockItem(type, id, cost). Never grants the unlock locally — always re-fetches after the server responds.</summary>
        public async Task UnlockAsync(RosterTab tab, string itemId)
        {
            string itemType = TypeString(tab);
            try
            {
                await _api.UnlockRosterItemAsync(itemType, itemId);
                OnUnlocked?.Invoke(itemType, itemId);
                await RefreshAsync();
            }
            catch (ApiRequestException e)
            {
                OnUnlockFailed?.Invoke(e.Message);
            }
        }
    }
}
