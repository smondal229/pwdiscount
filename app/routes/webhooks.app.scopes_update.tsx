import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // With MongoDBSessionStorage, session persistence is handled by the adapter.
  // We don't manually mutate session records in a database here.
  void payload;
  void session;

  return new Response();
};
