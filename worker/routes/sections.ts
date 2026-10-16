import { Hono } from "hono";
import {
  assignLine,
  ok,
  refuse,
  validateCode,
  validateSectionName,
  type Result,
} from "../../src/core";
import type {
  DeleteSectionResponse,
  SectionProblem,
  SectionResponse,
  SectionsResponse,
} from "../contract";
import { getDb } from "../db/client";
import {
  deleteSection,
  insertSection,
  loadSections,
  reorderSections,
  updateSection,
} from "../db/sections";
import type { AppEnv } from "../env";
import { isUniqueViolation, jsonObject, parseId } from "./params";

/** Two requests moving the colour counter at once: the loser tries again with the new colour. */
const CREATE_ATTEMPTS = 3;

/** Sections: create, rename or change code, reorder, delete. Names and codes follow src/core. */
export const sectionRoutes = new Hono<AppEnv>()
  /** POST /api/sections: a new section, last in the order, with the next colour. */
  .post("/", async (c) => {
    const body = await jsonObject(c.req);
    if (typeof body?.name !== "string" || typeof body.code !== "string") {
      return c.json({ error: "name and code are required" }, 400);
    }
    const db = getDb(c.env.DB);
    const userId = c.var.user.id;

    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
      const current = await loadSections(db, userId);
      const name = checkName(body.name);
      if (!name.ok) return c.json({ error: name.error }, 422);
      const code = checkCode(
        body.code,
        current.sections.map((s) => s.code),
      );
      if (!code.ok) return c.json({ error: code.error }, 422);

      const { line, nextLine } = assignLine(current.nextLine);
      let section;
      try {
        section = await insertSection(db, userId, {
          name: name.value,
          code: code.value,
          line,
          nextLine,
        });
      } catch (error) {
        if (isUniqueViolation(error)) return c.json({ error: "code-taken" }, 409);
        throw error;
      }
      if (section) {
        const response: SectionResponse = { section, nextLine };
        return c.json(response, 201);
      }
    }
    throw new Error("The colour counter kept changing while creating a section");
  })
  /** PATCH /api/sections/:id: a new name, a new code, or both. The colour stays. */
  .patch("/:id", async (c) => {
    const sectionId = parseId(c.req.param("id"));
    const body = await jsonObject(c.req);
    if (!sectionId || !body) return c.json({ error: "a section id and a body are required" }, 400);
    const { name, code } = body;
    if (name !== undefined && typeof name !== "string") return c.json({ error: "bad name" }, 400);
    if (code !== undefined && typeof code !== "string") return c.json({ error: "bad code" }, 400);

    const db = getDb(c.env.DB);
    const userId = c.var.user.id;
    const current = await loadSections(db, userId);
    if (!current.sections.some((s) => s.id === sectionId)) {
      return c.json({ error: "not_found" }, 404);
    }

    const change: { name?: string; code?: string } = {};
    if (name !== undefined) {
      const checked = checkName(name);
      if (!checked.ok) return c.json({ error: checked.error }, 422);
      change.name = checked.value;
    }
    if (code !== undefined) {
      const others = current.sections.filter((s) => s.id !== sectionId).map((s) => s.code);
      const checked = checkCode(code, others);
      if (!checked.ok) return c.json({ error: checked.error }, 422);
      change.code = checked.value;
    }
    if (Object.keys(change).length === 0) return c.json({ error: "nothing to change" }, 400);

    try {
      const section = await updateSection(db, userId, sectionId, change);
      if (!section) return c.json({ error: "not_found" }, 404);
      const response: SectionResponse = { section, nextLine: current.nextLine };
      return c.json(response);
    } catch (error) {
      if (isUniqueViolation(error)) return c.json({ error: "code-taken" }, 409);
      throw error;
    }
  })
  /** PUT /api/sections/order: the person's whole order, every section exactly once. */
  .put("/order", async (c) => {
    const body = await jsonObject(c.req);
    const ids = Array.isArray(body?.ids) ? body.ids.map(parseId) : null;
    if (!ids || ids.some((id) => id === null)) return c.json({ error: "ids are required" }, 400);

    const db = getDb(c.env.DB);
    const userId = c.var.user.id;
    const current = await loadSections(db, userId);
    const own = new Set(current.sections.map((s) => s.id));
    const given = new Set(ids);
    if (given.size !== ids.length || given.size !== own.size || ids.some((id) => !own.has(id!))) {
      return c.json({ error: "invalid-order" }, 422);
    }

    await reorderSections(db, userId, ids as number[]);
    const response: SectionsResponse = { sections: (await loadSections(db, userId)).sections };
    return c.json(response);
  })
  /** DELETE /api/sections/:id: the section with all its items and their reviews. */
  .delete("/:id", async (c) => {
    const sectionId = parseId(c.req.param("id"));
    if (!sectionId) return c.json({ error: "a section id is required" }, 400);
    const deletedItems = await deleteSection(getDb(c.env.DB), c.var.user.id, sectionId);
    if (deletedItems === null) return c.json({ error: "not_found" }, 404);
    const response: DeleteSectionResponse = { deletedItems };
    return c.json(response);
  });

function checkName(input: string): Result<string, SectionProblem> {
  const checked = validateSectionName(input);
  return checked.ok ? ok(checked.value) : refuse(`name-${checked.error}` as const);
}

function checkCode(input: string, otherCodes: string[]): Result<string, SectionProblem> {
  const checked = validateCode(input, otherCodes);
  return checked.ok ? ok(checked.value) : refuse(`code-${checked.error}` as const);
}
