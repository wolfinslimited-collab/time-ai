import { appleRevenue, googleRevenue } from './revenue.ts';
Deno.test('Source units and unknown values', () => {
 if (appleRevenue({price:169000000,currency:'IDR'})?.revenue_amount !== 169000) throw Error('Apple milliunit conversion');
 if (appleRevenue({}) !== null) throw Error('Missing is not zero');
 if (googleRevenue({total:{currencyCode:'CAD',units:'7',nanos:830000000}})?.revenue_amount !== 7.83) throw Error('Google Money conversion');
});
