import express from 'express';
import joi from 'joi';
import cors from 'cors';
import {MongoClient} from "mongodb";
import dotenv from 'dotenv';
import { json } from 'express'
import dayjs from 'dayjs';


const app = express();
app.use([cors(), json()]);



let db=null;
const mongo_url =  process.env.MONGODB_URL;
const mongoConection = new MongoClient(mongo_url);

mongoConection.connect().then(() => {
	db = mongoConection.db(process.env.MONGO_DB_NAME);
}).catch(err => {
    console.error(err);
});
dotenv.config();



const PORT =process.env.PORT||5000;

app.post('/participants', async (req, res)=>{

    const user = req.body;
    
    const userSchema = joi.object({
        name: joi.string().required()
    })

    const validation = userSchema.validate(user);
    if (validation.error) {
       return res.status(422).send();
      }

      const userExists = await db.collection("users").findOne({ name: user.name });
  
    if (userExists) {
        return res.sendStatus(409);    
    }

    await db.collection("users").insertOne({name: user.name, lastStatus: Date.now()})

    await db.collection('messages').insertOne({from: user.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:MM:SS')})

    res.status(201).send();

})


app.get("/participants", async (req, res) => {
      const users = await db.collection("users").find().toArray();
      res.send(users);
  });
  
  
app.post('/messages', async (req, res) => {
    const user= req.headers.user;
    const sender = await db.collection('users').find({ name: user });
    if(!sender)
    {
        return res.status(422).sender();
    }

    const message = req.body;
    const msgSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message')
    }) 
    const validation = msgSchema.validate(message, { abortEarly: true });

    if (validation.error) {
        return res.status(422).send();
        }

        const newMsg = {
            from: user,
            to: req.body.to,
            text: req.body.text,
            type: req.body.type,
            time: dayjs().format('HH:MM:ss')
        }
        await db.collection('messages').insertOne(newMsg);
        res.status(201).send();


  });

app.get("/messages", async (req, res) => {
    const user = req.headers.user;
    const limit  = parseInt(req.query.limit);
  
    const messages =  await db.collection("messages").find().toArray();

    const filterMessages = messages.filter((message) => (message.from === user || message.to === req.headers.user || message.to === "Todos" || message.type === "message"))
    if (limit && limit === NaN) 
    {
      return res.send(filterMessages.splice(-{limit}));
    }
   
    return res.send(filterMessages).status(201)
   

});

app.post("/status",  async (req, res) => 
{
	const user = await db.collection("users").findOne({ "name": req.headers.user } );
	if (user === null) {
		return res.status(404).send();
		
	}
		await db.collection("users").updateOne({ 
			"name" :  req.headers.user
		}, {$set: {"lastStatus" : Date.now() }})	
		return res.status(200).send();        
});

setInterval(async () => {
    const users = await db.collection('users').find().toArray();

    for (let user of users) {
        if (Date.now() - user.lastStatus > 10000) {
            await db.collection('users').deleteOne({ name: user.name });

          const msg = {
            from: user.name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time: dayjs().format('HH:MM:ss')
    }

    await db.collection('messages').insertOne(msg)
        }
    }

},  15000);
  
app.listen(PORT, ()=>{
    console.log(`Servidor rodando na porta ${PORT}`);
})