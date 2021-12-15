require("dotenv").config()
const fs = require('fs')
const Web3 = require('web3');
const {ChainId, Token, TokenAmount, Pair} = require('@uniswap/sdk');
const abis = require('./abis');
const { mainnet: addresses } = require('./addresses');
//const Flashloan = require('./build/contracts/Flashloan.json');

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.INFURA_URL)
);
const { address: admin } = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);

const uniswap = new web3.eth.Contract(
  abis.uniswap.uniswap,
  addresses.uniswap.router
)

const sushi = new web3.eth.Contract(
  abis.sushi.sushi,
  addresses.sushi.router
)

const ONE_WEI = web3.utils.toBN(web3.utils.toWei('1'));
//const AMOUNT_DAI_WEI = web3.utils.toBN(web3.utils.toWei('10000'));
const DIRECTION = {
  SUSHI_TO_UNISWAP: 0,
  UNISWAP_TO_SUSHI: 1
};

const init = async () => {
  const networkId = await web3.eth.net.getId();
  // const flashloan = new web3.eth.Contract(
  //   Flashloan.abi,
  //   Flashloan.networks[networkId].address
  // );
  
  // let ethPrice;
  // const updateEthPrice = async () => {
  //   const results = await uniswap.methods.getAmountsOut(web3.utils.toWei('1'), [addresses.tokens.weth, addresses.tokens.dai]).call();   //dai to wbnb pancakeswap
  //   ethPrice = web3.utils.toBN('1').mul(web3.utils.toBN(results[1])).div(ONE_WEI);
  // }
  // await updateEthPrice();
  // setInterval(updateEthPrice, 15000);

  web3.eth.subscribe('newBlockHeaders')
    .on('data', async block => {
      console.log('=====================================================');
      console.log(`New block received. Block # ${block.number}`);
      //fs.appendFileSync('Output.txt',  block.number + " : ");

      const uniswap_ethPrice = await uniswap.methods.getAmountsOut(web3.utils.toWei('1'), [addresses.tokens.weth, addresses.tokens.dai]).call();
      const sushi_ethPrice = await sushi.methods.getAmountsOut(web3.utils.toWei('1'), [addresses.tokens.weth, addresses.tokens.dai]).call();

      const minimum_price = Math.min(uniswap_ethPrice[1], sushi_ethPrice[1]);
      const maximum_price = Math.max(uniswap_ethPrice[1], sushi_ethPrice[1]);

      const price_diff = 100 * (maximum_price - minimum_price)/ minimum_price;

      console.log(`Uniswap Eth Price: ${uniswap_ethPrice[1] /  10 ** 18} Dai`);
      console.log(`Sushiswap Eth Price: ${sushi_ethPrice[1] /  10 ** 18} Dai`);
      console.log(`Spread: ${price_diff} %`);

      //---------------------------------- Calculating factor -------------------//
      let factor;
      if (price_diff >= 0 && price_diff < 1) {factor = 0.01
      } else if (price_diff >= 0.1 && price_diff < 1.5) {factor = 0.1;
        } else if (price_diff >= 1.5 && price_diff < 2.2) {factor = 0.15;
          } else if (price_diff >= 2.2 && price_diff < 2.9) {factor = 0.4;
            } else if (price_diff >= 2.9 && price_diff < 3.5) {factor = 0.6;
              } else if (price_diff >= 3.5 && price_diff < 4) {factor = 0.7;
                } else if (price_diff >= 4 && price_diff < 4.5) {factor = 0.75;
                  } else if (price_diff >= 4.5 && price_diff < 5) {factor = 0.9;
                    } else {factor = 1;}

      console.log(` Factor = ${factor} %`);

      // Requiring fs module in which
      // writeFile function is defined.
      
        
      // Data which will write in a file.
      //let data = "Learning how to write in a file."
        
      // Write data in 'Output.txt' .
      fs.appendFileSync('Output.txt', block.number + " : " + price_diff  + " % "+ minimum_price / (10 ** 18) + " \n"  );
      // fs.writeFile('Output.txt', price_diff + " , ", (err) => {
            
      //     // In case of a error throw err.
      //     if (err) throw err;
      // })

      //let capacity;
      //capacity = '150000000';
      console.log('=====================================================');

      console.log('=============== Getting Reserves =========================');
      //const reserve = await sushi.methods.getAmountOut(fa, [addresses.tokens.dai, addresses.tokens.weth]).call();
      const [dai, weth] = await Promise.all(
        [addresses.tokens.dai, addresses.tokens.weth].map(tokenAddress => (
          Token.fetchData(
            ChainId.MAINNET,
            tokenAddress,
          )
      )));
      const daiWeth = await Pair.fetchData(
        dai,
        weth,
      );
      const reserve_dai = await daiWeth.reserveOf(dai);
      const reserve_weth = await daiWeth.reserveOf(weth);
      console.log(`dai reserve = ${reserve_dai.toSignificant(6)} `);
      console.log(`weth reserve = ${reserve_weth.toSignificant(6)} `);
      console.log('=====================================================');
      console.log('=====================================================');
      const capacity = reserve_dai.toExact();
      const AMOUNT_DAI_WEI = web3.utils.toWei(web3.utils.toBN(Math.round(factor * capacity / 100)));


      //---------------------------------- ------------------ -------------------//

      const amountsOut1 = await sushi.methods.getAmountsOut(AMOUNT_DAI_WEI, [addresses.tokens.dai, addresses.tokens.weth]).call();   
      //console.log(`amountsOut1 : ${amountsOut1}`);
      const amountsOut2 = await uniswap.methods.getAmountsOut(amountsOut1[1], [addresses.tokens.weth, addresses.tokens.dai]).call();    
      const amountsOut3 = await uniswap.methods.getAmountsOut(AMOUNT_DAI_WEI, [addresses.tokens.dai, addresses.tokens.weth]).call();    
      const amountsOut4 = await sushi.methods.getAmountsOut(amountsOut3[1], [addresses.tokens.weth, addresses.tokens.dai]).call();   

      
      
      console.log(`Sushi -> Uniswap. Dai input / output: ${web3.utils.fromWei(AMOUNT_DAI_WEI.toString())} / ${web3.utils.fromWei(amountsOut2[1].toString())}`);
      console.log(`Uniswap -> Sushi. Dai input / output: ${web3.utils.fromWei(AMOUNT_DAI_WEI.toString())} / ${web3.utils.fromWei(amountsOut4[1].toString())}`);

      const daiFromUniswap = web3.utils.toBN(amountsOut2[1])
      const daiFromSushi = web3.utils.toBN(amountsOut4[1])


      if(daiFromUniswap.gt(AMOUNT_DAI_WEI)) {
        const tx = flashloan.methods.initiateFlashloan(
          addresses.dydx.solo, 
          addresses.tokens.dai, 
          AMOUNT_DAI_WEI,
          DIRECTION.SUSHI_TO_UNISWAP
        );
        const [gasPrice, gasCost] = await Promise.all([
          web3.eth.getGasPrice(),
          tx.estimateGas({from: admin}),
        ]);

        const txCost = web3.utils.toBN(gasCost).mul(web3.utils.toBN(gasPrice)).mul(ethPrice);
        const profit = daiFromUniswap.sub(AMOUNT_DAI_WEI).sub(txCost);

        if(profit > 0) {
          console.log('Arb opportunity found Sushi -> Uniswap!');
          console.log(`Expected profit: ${web3.utils.fromWei(profit)} Dai`);
          const data = tx.encodeABI();
          const txData = {
            from: admin,
            to: flashloan.options.address,
            data,
            gas: gasCost,
            gasPrice
          };
          const receipt = await web3.eth.sendTransaction(txData);
          console.log(`Transaction hash: ${receipt.transactionHash}`);
        }
      }

      if(daiFromSushi.gt(AMOUNT_DAI_WEI)) {
        const tx = flashloan.methods.initiateFlashloan(
          addresses.dydx.solo, 
          addresses.tokens.dai, 
          AMOUNT_DAI_WEI,
          DIRECTION.UNISWAP_TO_SUSHI
        );
        const [gasPrice, gasCost] = await Promise.all([
          web3.eth.getGasPrice(),
          tx.estimateGas({from: admin}),
        ]);
        const txCost = web3.utils.toBN(gasCost).mul(web3.utils.toBN(gasPrice)).mul(ethPrice);
        const profit = daiFromKyber.sub(AMOUNT_DAI_WEI).sub(txCost);

        if(profit > 0) {
          console.log('Arb opportunity found Uniswap -> Sushi!');
          console.log(`Expected profit: ${web3.utils.fromWei(profit)} Dai`);
          const data = tx.encodeABI();
          const txData = {
            from: admin,
            to: flashloan.options.address,
            data,
            gas: gasCost,
            gasPrice
          };
          const receipt = await web3.eth.sendTransaction(txData);
          console.log(`Transaction hash: ${receipt.transactionHash}`);
        }
      }
    })
    .on('error', error => {
      console.log(error);
    });
}
init();
