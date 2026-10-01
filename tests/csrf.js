import request from "supertest";
import app from "../src/app.js";

export async function getCsrfCredentials() {
  const res = await request(app).get("/api/csrf-token");

  if (res.status !== 200 || !res.body?.csrfToken) {
    throw new Error(`Failed to fetch CSRF token: ${res.status}`);
  }

  const cookie = res.headers["set-cookie"];
  if (!cookie) {
    throw new Error("Failed to fetch CSRF cookie");
  }

  return {
    token: res.body.csrfToken,
    cookie,
  };
}

export function applyCsrf(req, { token, cookie }) {
  return req.set("Cookie", cookie).set("X-CSRF-Token", token);
}

export async function createCsrfClient() {
  const credentials = await getCsrfCredentials();

  return {
    credentials,
    post(path) {
      return applyCsrf(request(app).post(path), credentials);
    },
    put(path) {
      return applyCsrf(request(app).put(path), credentials);
    },
    patch(path) {
      return applyCsrf(request(app).patch(path), credentials);
    },
    delete(path) {
      return applyCsrf(request(app).delete(path), credentials);
    },
  };
}
