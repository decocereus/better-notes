/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assets from "../assets.js";
import type * as classificationJobs from "../classificationJobs.js";
import type * as comparisonResults from "../comparisonResults.js";
import type * as extractionResults from "../extractionResults.js";
import type * as generatedNotes from "../generatedNotes.js";
import type * as projects from "../projects.js";
import type * as settings from "../settings.js";
import type * as themePages from "../themePages.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assets: typeof assets;
  classificationJobs: typeof classificationJobs;
  comparisonResults: typeof comparisonResults;
  extractionResults: typeof extractionResults;
  generatedNotes: typeof generatedNotes;
  projects: typeof projects;
  settings: typeof settings;
  themePages: typeof themePages;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
