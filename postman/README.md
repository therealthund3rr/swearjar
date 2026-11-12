1. Import: in Postman choose File > Import and pick postman/swearjar.postman_collection.json (Collection v2.1).
2. Set baseUrl in the collection variables (default http://localhost:3000); point it at your deployed host to test that instead.
3. Run order: Health & config, Jar setup, PayPal hold, Live session, Settlement, Receipts; the test scripts on Create jar, Join jar, Create order and End session fill code, playerId, orderId and receiptId.
4. The PayPal approval step happens in the browser: Create order only creates the AUTHORIZE order, the buyer approves it in the PayPal popup, and only then run Authorize order.
5. Start, multiplier and End need the creator playerId: run Create jar first, and run Join jar only for other players (it overwrites playerId).
