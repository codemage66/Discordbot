import api from "api";
import supabase from "./supabase.js";

const sdk = api("@writesonic/v2.2#4enbxztlcbti48j");

export default async function chatSonic(msg: string) {
  sdk.auth(process.env.CHAT_SONIC);
  try {
    var { data } = await sdk.chatsonic_V2BusinessContentChatsonic_post(
      {
        enable_google_results: "true",
        enable_memory: false,
        input_text: msg,
      },
      { engine: "premium" }
    );
    return { text: data.message, type: "chatsonic" };
  } catch (err) {
    return { error: err };
  }
}
