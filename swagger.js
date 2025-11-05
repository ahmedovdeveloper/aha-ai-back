// swagger.js
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

// === Конфигурация OpenAPI (Swagger) ===
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AHA AI API",
      version: "1.0.0",
      description:
        "API для AHA AI: регистрация пользователей, получение списка и генерация контента через OpenRouter",
      contact: {
        name: "Поддержка",
        url: "https://t.me/akhmad_x1",
      },
    },
    servers: [
      {
        url: "http://localhost:9000",
        description: "Локальный сервер",
      },
    ],
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "507f1f77bcf86cd799439011" },
            name: { type: "string", example: "Иван" },
            email: { type: "string", example: "ivan@example.com" },
            plan: {
              type: "string",
              enum: ["free", "pro", "ultimate"],
              example: "free",
            },
            freeRequestsUsed: { type: "integer", example: 0 },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        CreateUserRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "Иван" },
            email: { type: "string", example: "ivan@example.com" },
            password: { type: "string", example: "123456" },
          },
        },
        GenerateRequest: {
          type: "object",
          properties: {
            systemPrompt: { type: "string", example: "Ты — эксперт по маркетингу" },
            userPrompt: { type: "string", example: "Сделай план для кофейни" },
            model: { type: "string", default: "gpt-4o-mini" },
            temperature: { type: "number", default: 0.7 },
          },
        },
        GenerateResponse: {
          type: "object",
          properties: {
            result: { type: "string", example: "Вот ваш маркетинг-план..." },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./index.js"], // Мы используем inline-документацию (JSDoc) в server.js
};

const specs = swaggerJsdoc(options);

// === Экспорт роутера для Swagger UI ===
const swaggerRouter = [
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    customCss: `
      .swagger-ui .topbar {
        background: linear-gradient(90deg, #1e40af, #7c3aed);
        padding: 10px 0;
      }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info { margin: 30px 0; }
      .swagger-ui .scheme-container { background: #1a1a2e; border-bottom: 1px solid #374151; }
      .swagger-ui .opblock { border-radius: 12px; }
      .swagger-ui .btn.execute { background: #7c3aed; }
    `,
    customSiteTitle: "AHA AI API Docs",
    customfavIcon: "/favicon.ico",
  }),
];

export default swaggerRouter;