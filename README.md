# Stelace (dirty, unofficial) plugin: Stripeconnect webhook receiver

This is a quick and dirty fork from the official stelace-stripe plugin. Its sole purpose and tested ability is to enable my platform to receive Stripe Connect events. I simply replaced all occurences of "stripe" by "stripeconnect" in the code (except from 3 very important ones). 

Its configuration is pretty much the same as stelace-stripe : simply replace stripe by stripeconnect when registering the integration, and don't forget to use the Stripe Connect webhook secret (available in Stripe Dashboard) as webhookSecret. When registering the endpoint in your Stripe Dashboard, use this path : /integrations/stripeconnect/webhooks/[your platform Id]
