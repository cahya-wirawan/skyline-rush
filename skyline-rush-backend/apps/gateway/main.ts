import { createGatewayApp } from './gateway.app';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  const app = createGatewayApp();
  app.listen(PORT, () => {
    console.log(`Skyline Rush API Gateway listening on port ${PORT}`);
  });
}

bootstrap();
