import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import dnsPromise from "node:dns/promises";
import { mongo } from "./db.mongo.server";

dnsPromise.setDefaultResultOrder('ipv4first')
dnsPromise.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error("MONGO_URI is required to run this app.");
}

const mongoDbName = process.env.MONGO_DB || "pwdiscount";
const mongoConnection = mongo;
console.log("mongoUri", mongoUri);
console.log("mongoDbName", mongoDbName);
// console.log("mongo configuration-------------------", JSON.stringify(mongo.connection));
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new MongoDBSessionStorage(
    new URL("mongodb+srv://suvodipDBAdmin:ECR6wwHUYIeqj98F@discount-app.h3gtj7b.mongodb.net/?retryWrites=true&w=majority&appName=discount-app"),
    'pwdiscount'
  ),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
