using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    /// <summary>Static catalog entry mirroring one `onclick="window.game.buyPack(sku, coresAmount, price)"` button in web/index.html's shop modal.</summary>
    public class ShopSku
    {
        public string SkuId { get; }
        public string DisplayName { get; }
        public int CoresAmount { get; }
        public decimal PriceUsd { get; }

        public ShopSku(string skuId, string displayName, int coresAmount, decimal priceUsd)
        {
            SkuId = skuId;
            DisplayName = displayName;
            CoresAmount = coresAmount;
            PriceUsd = priceUsd;
        }
    }

    /// <summary>
    /// Pure C# state/logic class mirroring the web client's Shop flow (web/game.js: openShop,
    /// closeShop, buyPack, completePurchase, openParentalGate). Not a MonoBehaviour — a future
    /// thin Canvas view calls into this and reads its state/events.
    ///
    /// Purchase flow (matches game.js's buyPack exactly):
    /// 1. RequestPurchaseAsync(skuId, ageBucket) is called by the view on a "BUY"/"ACQUIRE" tap.
    /// 2. If ageBucket == "under_13", the purchase is NOT submitted yet: OnParentalGateRequired
    ///    fires so the view can show ParentalGateController's PIN-pad flow. The sku is cached in
    ///    PendingSku until the caller resolves the gate.
    /// 3. Once ParentalGateController yields a parental_gate_token (or immediately for non-minors),
    ///    the view calls CompletePurchaseAsync(skuId, parentalGateToken) which submits the receipt.
    ///
    /// The client never grants Cores/entitlements itself — SkylineRushApiService.SubmitPurchaseReceiptAsync
    /// is the only path, and the server is the sole source of truth for what was granted
    /// (CLAUDE.md #1). A fresh idempotency key is generated per purchase attempt by the API service.
    /// </summary>
    public class ShopController
    {
        /// <summary>Fixed catalog mirroring web/index.html's shop modal SKUs exactly.</summary>
        public static readonly IReadOnlyList<ShopSku> Catalog = new List<ShopSku>
        {
            new ShopSku("starter_pack", "Starter Bundle (10,000 Chips + 50 Cores + Neon Trail)", 50, 0.99m),
            new ShopSku("remove_interstitials", "Ad Suppression (removes interstitial video ads)", 0, 4.99m),
            new ShopSku("cores_small", "50 Cores", 50, 0.99m),
            new ShopSku("cores_medium", "120 Cores", 120, 1.99m),
            new ShopSku("cores_large", "260 Cores", 260, 4.99m),
            new ShopSku("cores_xl", "600 Cores", 600, 9.99m),
            new ShopSku("cores_vault", "1,400 Cores", 1400, 19.99m),
        };

        private readonly SkylineRushApiService _api;

        public bool IsVisible { get; private set; } = false;
        public bool IsPurchaseInFlight { get; private set; } = false;
        public string PendingSkuId { get; private set; } = null;
        public string LastErrorMessage { get; private set; } = null;
        public PurchaseReceiptResponseDto LastGrantedEntitlement { get; private set; } = null;

        /// <summary>Fired when a minor (age_bucket == "under_13") attempts a purchase and must clear the parental gate first.</summary>
        public event Action<string> OnParentalGateRequired;
        public event Action<PurchaseReceiptResponseDto> OnPurchaseSucceeded;
        public event Action<string> OnPurchaseFailed;

        public ShopController(SkylineRushApiService api)
        {
            _api = api;
        }

        public void Open() => IsVisible = true;

        public void Close() => IsVisible = false;

        public static ShopSku FindSku(string skuId)
        {
            foreach (var sku in Catalog)
            {
                if (sku.SkuId == skuId) return sku;
            }
            return null;
        }

        /// <summary>Mirrors game.js's buyPack(sku, coresAmount, price) age-bucket branch exactly.</summary>
        public async Task RequestPurchaseAsync(string skuId, string ageBucket)
        {
            if (ageBucket == "under_13")
            {
                PendingSkuId = skuId;
                OnParentalGateRequired?.Invoke(skuId);
                return;
            }

            await CompletePurchaseAsync(skuId, null);
        }

        /// <summary>Mirrors game.js's completePurchase(sku, coresAmount, gateToken). Generates its own mock transaction id, matching the reference client's `in_app_tx_{timestamp}_{rand}` pattern.</summary>
        public async Task CompletePurchaseAsync(string skuId, string parentalGateToken)
        {
            IsPurchaseInFlight = true;
            LastErrorMessage = null;

            try
            {
                string transactionId = $"in_app_tx_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N").Substring(0, 5)}";
                var result = await _api.SubmitPurchaseReceiptAsync(
                    skuId,
                    transactionId,
                    "mock_signed_jws_payload",
                    parentalGatePassed: parentalGateToken != null,
                    parentalGateToken: parentalGateToken);

                LastGrantedEntitlement = result;
                PendingSkuId = null;
                OnPurchaseSucceeded?.Invoke(result);
            }
            catch (ApiRequestException e)
            {
                LastErrorMessage = e.Message;
                OnPurchaseFailed?.Invoke(LastErrorMessage);
            }
            finally
            {
                IsPurchaseInFlight = false;
            }
        }
    }
}
