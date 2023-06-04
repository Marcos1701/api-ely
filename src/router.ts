import express, { Application, Router, Request, Response } from "express";

import {
    insertPostagem, retrievePostagem, retrieveAllPostagens, curtirPostagem,
    updatePostagem, deletePostagem, retrieveAllComentariostoPostagem, retrieveComentario,
    insertComentario, updateComentario, deleteComentario
} from './consultas_bd.js'

const app: Application = express();
const router: Router = express.Router();

app.use(express.json());

router.get('/', (req: Request, res: Response) => {
    res.send('Bem vindo ao microblog!!')
});

router.get('/posts', retrieveAllPostagens);
router.get('/posts/:id', retrievePostagem);
router.post('/posts', insertPostagem);
router.put('/posts/:id', updatePostagem);
router.patch('/posts/:id', updatePostagem);
router.delete('/posts/:id', deletePostagem);
router.patch('/posts/:id/like', curtirPostagem);
router.post('/posts/:id/like', curtirPostagem)
router.post('/posts/:id/comentarios', insertComentario);
router.get('/posts/:id/comentarios', retrieveAllComentariostoPostagem);
router.get('/posts/:id/comentarios/:id_comentario', retrieveComentario);
router.put('/posts/:id/comentarios/:id_comentario', updateComentario);
router.delete('/posts/:id/comentarios/:id_comentario', deleteComentario);

export default router;