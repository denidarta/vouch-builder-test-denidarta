# S1: Scaffold + API + Swagger

**Time budget:** ~25min
**Depends on:** Nothing
**Ships:** Running NestJS app with Swagger UI, health check, POST endpoint accepting handover request (returns stub response)

## Done When

- [ ] NestJS project bootstrapped with required packages
- [ ] `GET /api/health` returns `{ status: "ok" }`
- [ ] `POST /api/handover/generate` accepts request DTO, returns stub handover shape
- [ ] Swagger UI at `GET /api/docs`
- [ ] Middleware stack wired: helmet, compression, correlation-id, pino
- [ ] Global validation pipe + exception filter active
- [ ] `npm run start:dev` works

## Request DTO

```typescript
class GenerateHandoverDto {
  hotel: HotelDto;        // { id, name, rooms, timezone }
  events: EventDto[];     // structured events array
  nightLogs: NightLogDto[]; // { date, content }
  targetDate: string;     // ISO date for the morning handover
}
```

## Stub Response Shape

```json
{
  "hotel": { "id": "lumen-sg", "name": "Lumen Boutique Hotel" },
  "generatedAt": "...",
  "shiftDate": "2026-05-30",
  "handover": {
    "actionRequired": [],
    "pending": [],
    "resolved": [],
    "fyi": []
  },
  "dataQuality": {
    "warnings": [],
    "flaggedEntries": [],
    "incompleteEntries": []
  }
}
```

## Project Structure After S1

```
src/
├── app.module.ts
├── main.ts
├── handover/
│   ├── handover.module.ts
│   ├── handover.controller.ts
│   ├── handover.service.ts          # returns stub
│   └── dto/
│       ├── generate-handover.dto.ts
│       └── handover-response.dto.ts
├── health/
│   ├── health.module.ts
│   └── health.controller.ts
└── common/
    ├── common.module.ts
    ├── middleware/
    │   └── correlation-id.middleware.ts
    ├── interceptors/
    │   └── logging.interceptor.ts
    ├── filters/
    │   └── http-exception.filter.ts
    └── types/
        ├── event.interface.ts
        ├── hotel.interface.ts
        └── handover.interface.ts
```

## Packages

```
@nestjs/core @nestjs/common @nestjs/platform-express @nestjs/swagger
nestjs-pino pino-http pino-pretty
helmet compression
class-validator class-transformer
uuid
```
