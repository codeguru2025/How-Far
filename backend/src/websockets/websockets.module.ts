import { Module } from '@nestjs/common';
import { LocationGateway } from './location.gateway';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [DriversModule],
  providers: [LocationGateway],
  exports: [LocationGateway],
})
export class WebsocketsModule {}
