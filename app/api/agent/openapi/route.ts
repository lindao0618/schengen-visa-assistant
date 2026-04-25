import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function buildServerUrl(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim()

  if (forwardedHost) {
    return `${forwardedProto || "http"}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

export async function GET(request: NextRequest) {
  const serverUrl = buildServerUrl(request)

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Visa Assistant Agent API",
      version: "0.1.0",
      description: "Machine-oriented API surface for applicant workspace, task lookup, corrections, and file operations.",
    },
    servers: [{ url: serverUrl }],
    security: [{ bearerAuth: [] }, { AgentApiKey: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Browser session bearer is not used directly; this is reserved for future machine tokens.",
        },
        AgentApiKey: {
          type: "apiKey",
          in: "header",
          name: "x-agent-api-key",
          description: "Machine key bound to AGENT_API_KEY.",
        },
      },
      schemas: {
        AgentActor: {
          type: "object",
          properties: {
            userId: { type: "string" },
            role: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            authMode: { type: "string", enum: ["session", "api_key"] },
            isMachine: { type: "boolean" },
          },
          required: ["userId", "authMode", "isMachine"],
        },
        AgentTask: {
          type: "object",
          properties: {
            system: { type: "string", enum: ["usa-visa", "france-visa"] },
            task_id: { type: "string" },
            type: { type: "string" },
            status: { type: "string" },
            progress: { type: "number" },
            message: { type: "string" },
            created_at: { type: "number" },
            updated_at: { type: "number" },
            result: { type: "object", additionalProperties: true },
            error: { type: "string" },
            applicantProfileId: { type: "string" },
            applicantName: { type: "string" },
            caseId: { type: "string" },
            caseLabel: { type: "string" },
          },
          required: ["system", "task_id", "type", "status", "progress", "message", "created_at"],
        },
        GenericObject: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    paths: {
      "/api/agent/session": {
        get: {
          summary: "Get current agent actor",
          responses: {
            "200": {
              description: "Current actor",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      actor: { $ref: "#/components/schemas/AgentActor" },
                      auth: { $ref: "#/components/schemas/GenericObject" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/openapi": {
        get: {
          summary: "Get this OpenAPI document",
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
      "/api/agent/applicants": {
        get: {
          summary: "Search or list applicants",
          parameters: [
            { in: "query", name: "keyword", schema: { type: "string" } },
            { in: "query", name: "visaTypes", schema: { type: "string" } },
            { in: "query", name: "statuses", schema: { type: "string" } },
            { in: "query", name: "regions", schema: { type: "string" } },
            { in: "query", name: "priorities", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Applicant CRM data",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
        post: {
          summary: "Create applicant profile, optionally create first case",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created applicant and optional case",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
      },
      "/api/agent/applicants/{id}": {
        get: {
          summary: "Get one applicant with case detail",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Applicant detail",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
        put: {
          summary: "Update applicant profile fields",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
          responses: { "200": { description: "Updated profile" } },
        },
        delete: {
          summary: "Delete applicant profile",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/agent/applicants/{id}/parsed-intake": {
        get: {
          summary: "Get parsed applicant intake data from structured files and Excel sources",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Parsed intake data",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
      },
      "/api/agent/applicants/{id}/us-visa-intake": {
        get: {
          summary: "Get dedicated U.S. visa intake view with full extracted Excel fields and photo links",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "U.S. visa intake view",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
      },
      "/api/agent/applicants/{id}/schengen-intake": {
        get: {
          summary: "Get dedicated Schengen intake view with full extracted Excel fields",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Schengen intake view",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
      },
      "/api/agent/applicants/{id}/files": {
        post: {
          summary: "Upload one or more applicant files by slot name",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  additionalProperties: {
                    type: "string",
                    format: "binary",
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Upload result with audits and parsed fields" } },
        },
      },
      "/api/agent/applicants/{id}/files/{slot}": {
        get: {
          summary: "Get applicant file metadata or raw content",
          parameters: [
            { in: "path", name: "id", required: true, schema: { type: "string" } },
            { in: "path", name: "slot", required: true, schema: { type: "string" } },
            { in: "query", name: "raw", schema: { type: "string", enum: ["1"] } },
            { in: "query", name: "download", schema: { type: "string", enum: ["1"] } },
          ],
          responses: { "200": { description: "Metadata or file stream" } },
        },
        put: {
          summary: "Replace a file in one slot",
          parameters: [
            { in: "path", name: "id", required: true, schema: { type: "string" } },
            { in: "path", name: "slot", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: { type: "string", format: "binary" },
                  },
                },
              },
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          responses: { "200": { description: "Replacement result" } },
        },
        delete: {
          summary: "Delete a file from one slot",
          parameters: [
            { in: "path", name: "id", required: true, schema: { type: "string" } },
            { in: "path", name: "slot", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/agent/applicants/{id}/files/{slot}/parsed": {
        get: {
          summary: "Get parsed JSON view for one applicant file slot",
          parameters: [
            { in: "path", name: "id", required: true, schema: { type: "string" } },
            { in: "path", name: "slot", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Parsed file content or structured extraction result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
      },
      "/api/agent/cases": {
        get: {
          summary: "List cases",
          parameters: [{ in: "query", name: "applicantProfileId", schema: { type: "string" } }],
          responses: { "200": { description: "Case list" } },
        },
        post: {
          summary: "Create a case",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
          responses: { "201": { description: "Created case" } },
        },
      },
      "/api/agent/cases/{id}": {
        get: {
          summary: "Get case detail",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Case detail" } },
        },
        patch: {
          summary: "Update case basics",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
          responses: { "200": { description: "Updated case" } },
        },
      },
      "/api/agent/cases/{id}/status": {
        patch: {
          summary: "Advance or correct case status",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
          responses: { "200": { description: "Updated case status" } },
        },
      },
      "/api/agent/tasks": {
        get: {
          summary: "List unified agent tasks",
          parameters: [
            { in: "query", name: "limit", schema: { type: "integer" } },
            { in: "query", name: "status", schema: { type: "string" } },
            { in: "query", name: "system", schema: { type: "string", enum: ["usa-visa", "france-visa"] } },
            { in: "query", name: "applicantProfileId", schema: { type: "string" } },
            { in: "query", name: "caseId", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Task list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      tasks: {
                        type: "array",
                        items: { $ref: "#/components/schemas/AgentTask" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/tasks/{taskId}": {
        get: {
          summary: "Get one unified task",
          parameters: [
            { in: "path", name: "taskId", required: true, schema: { type: "string" } },
            { in: "query", name: "system", schema: { type: "string", enum: ["usa-visa", "france-visa"] } },
          ],
          responses: {
            "200": {
              description: "Task detail",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      task: { $ref: "#/components/schemas/AgentTask" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/workspace": {
        get: {
          summary: "Get one applicant workspace view with files, cases, tasks, and missing items",
          parameters: [
            { in: "query", name: "applicantProfileId", schema: { type: "string" } },
            { in: "query", name: "caseId", schema: { type: "string" } },
            { in: "query", name: "taskLimit", schema: { type: "integer" } },
          ],
          responses: {
            "200": {
              description: "Applicant workspace",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GenericObject" },
                },
              },
            },
          },
        },
      },
    },
  })
}
