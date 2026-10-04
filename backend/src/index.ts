import { Hono } from 'hono';

const application = new Hono();

application.get('/health', (context) => {
  return context.json({ service: 'sudhar-lab-api', status: 'ok' });
});

export default application;
