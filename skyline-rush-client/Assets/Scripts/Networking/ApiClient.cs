using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SkylineRush.Networking
{
    public interface IHttpTransport
    {
        Task<HttpResponse> SendAsync(string method, string url, string bodyJson, Dictionary<string, string> headers);
    }

    public class HttpResponse
    {
        public int StatusCode { get; set; }
        public string BodyJson { get; set; }
        public bool IsSuccess => StatusCode >= 200 && StatusCode < 300;
    }

    public class ApiClient
    {
        public string BaseUrl { get; set; } = "https://api.skylinerush.game";
        public string AccessToken { get; set; }
        private readonly IHttpTransport _transport;

        public ApiClient(IHttpTransport transport, string baseUrl = "https://api.skylinerush.game")
        {
            _transport = transport;
            BaseUrl = baseUrl;
        }

        public async Task<HttpResponse> PostAsync(string path, string jsonPayload, string idempotencyKey = null)
        {
            var headers = new Dictionary<string, string>
            {
                { "Content-Type", "application/json" }
            };

            if (!string.IsNullOrEmpty(AccessToken))
            {
                headers["Authorization"] = $"Bearer {AccessToken}";
            }

            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                headers["Idempotency-Key"] = idempotencyKey;
            }

            string fullUrl = $"{BaseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
            return await _transport.SendAsync("POST", fullUrl, jsonPayload, headers);
        }

        public async Task<HttpResponse> GetAsync(string path)
        {
            var headers = new Dictionary<string, string>();
            if (!string.IsNullOrEmpty(AccessToken))
            {
                headers["Authorization"] = $"Bearer {AccessToken}";
            }

            string fullUrl = $"{BaseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
            return await _transport.SendAsync("GET", fullUrl, null, headers);
        }
    }
}
