using System;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Billing
{
    public class StoreKitWrapper
    {
        private readonly ApiClient _apiClient;

        public StoreKitWrapper(ApiClient apiClient)
        {
            _apiClient = apiClient;
        }

        public async Task<PurchaseReceiptResponseDto> SubmitReceiptAsync(
            string sku,
            string transactionId,
            string signedTransaction,
            bool parentalGatePassed = false,
            string parentalGateToken = null,
            string idempotencyKey = null)
        {
            var req = new PurchaseReceiptRequestDto
            {
                sku = sku,
                transaction_id = transactionId,
                signed_transaction = signedTransaction,
                parental_gate_passed = parentalGatePassed,
                parental_gate_token = parentalGateToken
            };

            string json = UnityEngine_JsonMock(req);
            var response = await _apiClient.PostAsync("/v1/purchases/receipt", json, idempotencyKey ?? Guid.NewGuid().ToString());

            if (!response.IsSuccess)
            {
                throw new Exception($"Purchase receipt validation failed with code: {response.StatusCode}, details: {response.BodyJson}");
            }

            // In production, parse JSON using JsonUtility
            return new PurchaseReceiptResponseDto
            {
                status = response.BodyJson.Contains("duplicate") ? "duplicate" : "granted"
            };
        }

        private string UnityEngine_JsonMock(PurchaseReceiptRequestDto dto)
        {
            return $"{{\"sku\":\"{dto.sku}\",\"transaction_id\":\"{dto.transaction_id}\",\"signed_transaction\":\"{dto.signed_transaction}\",\"parental_gate_passed\":{(dto.parental_gate_passed ? "true" : "false")},\"parental_gate_token\":{(dto.parental_gate_token != null ? $"\"{dto.parental_gate_token}\"" : "null")}}}";
        }
    }
}
