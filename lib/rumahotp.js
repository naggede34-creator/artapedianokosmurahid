import axios from "axios";

const BASE_URL = "https://www.rumahotp.io/api";

async function rumahOtpGet(apikey, endpoint, params = {}) {
  const { data } = await axios.get(`${BASE_URL}${endpoint}`, {
    params,
    headers: { "x-apikey": apikey, accept: "application/json" },
    timeout: 20000
  });
  return data;
}

export async function getServices(apikey) {
  return rumahOtpGet(apikey, "/v2/services");
}

export async function getCountries(apikey, serviceId) {
  return rumahOtpGet(apikey, "/v2/countries", { service_id: serviceId });
}

export async function getOperators(apikey, country, providerId) {
  return rumahOtpGet(apikey, "/v2/operators", { country, provider_id: providerId });
}

export async function createOrder(apikey, { numberId, providerId, operatorId }) {
  return rumahOtpGet(apikey, "/v2/orders", {
    number_id: numberId,
    provider_id: providerId,
    operator_id: operatorId
  });
}

export async function checkOrderStatus(apikey, orderId) {
  return rumahOtpGet(apikey, "/v1/orders/get_status", { order_id: orderId });
}

export async function setOrderStatus(apikey, orderId, status) {
  return rumahOtpGet(apikey, "/v1/orders/set_status", { order_id: orderId, status });
}
