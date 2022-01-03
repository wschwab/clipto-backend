import { Body, Controller, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { VerifiedUser, Request } from '@prisma/client';
import { AppService } from './app.service';
import { VerifyUserDto } from './dto/VerifyUser.dto';
import { UserService } from './services/user.service';
import { CreateUserDto } from './dto/CreateUserDto';
import { CreateRequestDto } from './dto/CreateRequestDto';
import { RequestService } from './services/request.service';
import { BlockchainService } from './services/blockchain.service';
import { FinishRequestDto } from './dto/FinishRequestDto';
import { UploadFileDto } from './dto/UploadFileDto';
import axios from 'axios';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly userService: UserService,
    private readonly blockchainService: BlockchainService,
    private readonly requestService: RequestService,
  ) {}
  @Get('users')
  public async getUsers(): Promise<Array<VerifiedUser> | any> {
    const result = await this.userService.users({});
    if (!result) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('user/:address')
  public async getUser(@Param('address') address: string): Promise<VerifiedUser | any> {
    const result = await this.userService.user({ address });
    if (!result) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Post('user/verify')
  public async verifyUser(@Body() verifyUserDto: VerifyUserDto) {
    const { address, tweetUrl } = verifyUserDto;
    return await this.appService.verifyTwitter(tweetUrl, address);
  }

  @Post('user/create')
  public async create(@Body() createUserDto: CreateUserDto) {
    const { address, tweetUrl } = createUserDto;
    const tweetResponse = await this.appService.verifyTwitter(tweetUrl, address);

    const existingUser = await this.userService.user({ address });
    if (existingUser) {
      throw new HttpException('User already created!', HttpStatus.BAD_REQUEST);
    }
    const result = await this.userService.createUser({
      twitterHandle: tweetResponse.includes.users[0].username,
      address,
      profilePicture: createUserDto.profilePicture,
      deliveryTime: createUserDto.deliveryTime,
      bio: createUserDto.bio,
      demos: createUserDto.demos,
      userName: createUserDto.userName,
      price: createUserDto.price
    });
    return result;
  }

  @Post('request/create')
  public async requestCreate(@Body() createRequestDto: CreateRequestDto) {
    if (
      await this.blockchainService.validateRequestTx(
        createRequestDto.txHash,
        createRequestDto.amount,
        createRequestDto.requester,
      )
    ) {
      return this.requestService.createRequest(createRequestDto);
    }
    throw new HttpException('Invalid associated TX hash!', HttpStatus.BAD_REQUEST);
  }

  @Get('request/receiver/:address')
  public async requestByReceiver(@Param('address') address: string): Promise<Request[]> {
    const result = await this.requestService.requests({ where: { requester: address } });
    if (!result) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('request/creator/:address')
  public async requestByCreator(@Param('address') address: string): Promise<Request[]> {
    const result = await this.requestService.requests({ where: { creator: address } });
    if (!result) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('request/creator/:address/:requestId')
  public async requestByCreatorAndRequestId(
    @Param('address') address: string,
    @Param('requestId') requestId: string,
  ): Promise<Request> {
    const result = await this.requestService.requests({ where: { creator: address, requestId: parseInt(requestId) } });
    if (!result) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (result[1]) {
      //if length has more than one entry, this should be unique and something is very wrong
      throw new HttpException('Hackers or bugs?', HttpStatus.NOT_FOUND);
    }
    return result[0];
  }

  @Post('request/finish')
  public async requestFinish(@Body() finishRequestDto: FinishRequestDto) {
    if (await this.blockchainService.validateDeliverTx(finishRequestDto.txHash, finishRequestDto.creatorAddress)) {
      return this.requestService.updateRequest({ where: { id: finishRequestDto.id }, data: { delivered: true } });
    }
    //throw new HttpException('Invalid associated TX hash!', HttpStatus.BAD_REQUEST);
  }
  //todo: request / profile updates, these have to be predecated against signTypedData_v4 from users, as well as checking the relevant TXes

  //todo: make UploadFileDto take signTypedData v4, validate address against list of creators
  @Post('upload')
  async uploadFile(@Body() uploadFileDto: UploadFileDto) {
    return (await axios.post(process.env.GLASS_API_URL, { ...uploadFileDto })).data;
  }
}
