import axios from "axios";

const BASE_URL = "https://app.pakasir.com/api";

export async function createTransaction(project, apikey, orderId, amount, method = "qris") {
  const { data } = await axios.post(
    `${BASE_URL}/transactioncreate/${method}`,
    { project, order_id: orderId, amount, api_key: apikey },
    { headers: { "Content-Type": "application/json" } }
  );
  return data;
}

export async function checkTransaction(project, apikey, orderId, amount) {
  const { data } = await axios.get(`${BASE_URL}/transactiondetail`, {
    params: { project, order_id: orderId, amount, api_key: apikey }
  });
  return data;
}

export async function cancelTransaction(project, apikey, orderId, amount) {
  const { data } = await axios.post(
    `${BASE_URL}/transactioncancel`,
    { project, order_id: orderId, amount, api_key: apikey },
    { headers: { "Content-Type": "application/json" } }
  );
  return data;
}
