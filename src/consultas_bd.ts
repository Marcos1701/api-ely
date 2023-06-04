import { Request, Response } from 'express'

import { client } from './conf_bd_pg.js'
import { v4 as uuid } from 'uuid'

const validastring = (id: string) => {
    if (id === '' || id === undefined || id === null) {
        return false
    }
    return true
}
(async () => {
    try {
        await client.connect()
        await client.query(`
        CREATE TABLE IF NOT EXISTS postagens (
         id varchar not null PRIMARY KEY,
         title varchar NOT NULL,
         text varchar NOT NULL,
         likes INT,
         data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
        await client.query(`
    CREATE TABLE IF NOT EXISTS comentarios (
        id varchar PRIMARY KEY,
        text varchar NOT NULL,
        postagem_id varchar NOT NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (postagem_id) REFERENCES postagens(id)
    );
    `);
        console.log("Banco de dados conectado com sucesso!!")
        // console.log("Tabelas criadas com sucesso!")
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao criar tabelas: ${err.message}`)
        }
    }
})();

export async function insertPostagem(req: Request, res: Response) {
    const { title, text, like } = req.body
    try {
        await client.query(`
        INSERT INTO postagens (id,title, text, likes,data_criacao) VALUES ('${uuid()}',${title}, '${text}',${like} , DEFAULT)`)
        res.sendStatus(201);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao inserir postagem: ${err.message}`)
            res.sendStatus(400);
        }
    }

}

export async function retrievePostagem(req: Request, res: Response) {

    const { id } = req.params
    if (!validastring(id)) {
        res.sendStatus(400);
    }
    try {
        const postagem = await client.query(`
        SELECT * FROM postagens WHERE id = '${id}'`)
        res.json({ "postagem": postagem.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar postagem: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function retrieveAllPostagens(req: Request, res: Response) {
    try {
        const postagens = await client.query(`
        SELECT * FROM postagens`)
        res.json({ "postagens": postagens.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar postagens: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function updatePostagem(req: Request, res: Response) {
    const { id } = req.params
    let { title, text, likes } = req.body
    likes = parseInt(likes)
    if (!validastring(text) && validastring(likes) && validastring(likes) || !validastring(id)) {
        res.sendStatus(400);
    }
    try {
        if (likes && title && text && !isNaN(likes)) {
            await client.query(`
            UPDATE postagens SET title = '${title}', text = '${text}', likes = ${likes} WHERE id = '${id}'`)

        } else if (!isNaN(likes)) {
            await client.query(`
            UPDATE postagens SET text = '${text}', likes = ${likes} WHERE id = '${id}'`)
        } else {
            await client.query(`
            UPDATE postagens SET text = '${text}' WHERE id = '${id}'`)
        }
        res.sendStatus(200);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao atualizar postagem: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function deletePostagem(req: Request, res: Response) {
    const { id } = req.params

    if (!validastring(id)) {
        res.sendStatus(400);
    }
    try {
        await client.query(`
        DELETE FROM postagens WHERE id = '${id}'`)
        res.sendStatus(204);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao deletar postagem: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function curtirPostagem(req: Request, res: Response) {
    const { id } = req.params

    if (!validastring(id)) {
        res.sendStatus(400);
    }
    try {
        await client.query(`
        UPDATE postagens SET likes = likes + 1 WHERE id = '${id}'`)
        const likes = await client.query(`
        SELECT likes FROM postagens WHERE id = '${id}'`)
        res.sendStatus(200).json({ "likes": likes.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao curtir postagem: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function insertComentario(req: Request, res: Response) {
    const { id } = req.params
    const { text } = req.body

    if (!validastring(id) || !text || text === '') {
        res.sendStatus(400);
    }
    try {
        await client.query(`
        INSERT INTO comentarios (id, text, postagem_id, data_criacao) VALUES ('${uuid()}', '${text}', '${id}', DEFAULT)`)
        res.sendStatus(201);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao inserir comentario: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function retrieveComentario(req: Request, res: Response) {
    const { id, id_comentario } = req.params
    if (!validastring(id) || !validastring(id_comentario)) {
        res.sendStatus(400);
    }
    try {
        await client.query(`
        SELECT * FROM comentarios WHERE id = '${id_comentario} and postagem_id = '${id}'`)
            .then((comentario) => {
                res.json({ "comentario": comentario.rows })
            })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar comentario: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function retrieveAllComentariostoPostagem(req: Request, res: Response) {
    const { id } = req.params
    if (!validastring(id)) {
        res.sendStatus(400);
    }

    try {
        await client.query(`
        SELECT * FROM comentarios WHERE postagem_id = '${id}'`)
            .then((comentarios) => {
                res.json({ "comentarios": comentarios.rows })
            })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar comentarios: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function updateComentario(req: Request, res: Response) {
    const { id, id_comentario } = req.params
    const { text } = req.body
    if (!text || !validastring(id_comentario) || !validastring(id)) {
        res.sendStatus(400);
    }
    try {
        await client.query(`
        UPDATE comentarios SET text = '${text}' WHERE id = '${id_comentario} and postagem_id = '${id}'`)
        res.sendStatus(200);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao atualizar comentario: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function deleteComentario(req: Request, res: Response) {
    const { id, id_comentario } = req.params
    if (!validastring(id_comentario) || !validastring(id)) {
        res.sendStatus(400);
    }

    try {
        await client.query(`
        DELETE FROM comentarios WHERE id = '${id_comentario} and postagem_id = '${id}'`)
        res.sendStatus(204);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao deletar comentario: ${err.message}`)
            res.sendStatus(400);
        }
    }
}