import { Request, Response } from 'express'

import { client } from './conf_bd_pg.js'
import { v4 as uuid } from 'uuid'
import * as crypto from 'crypto'

const validastring = (id: string) => {
    if (id === '' || id === undefined || id === null) {
        console.log(`O valor ${id} é inválido!`)
        return false
    }
    return true
}

(async () => {
    try {
        await client.connect()

        await client.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id varchar not null PRIMARY KEY,
            nome_de_usuario varchar NOT NULL,
            senha varchar NOT NULL,
            token varchar not null
        )
    `);
        await client.query(`
        CREATE TABLE IF NOT EXISTS postagens (
         id varchar not null PRIMARY KEY,
         id_usuario varchar NOT NULL,
         title varchar NOT NULL,
         text varchar NOT NULL,
         likes INT,
         data_criacao DATE DEFAULT CURRENT_DATE,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
        )
    `);
        await client.query(`
    CREATE TABLE IF NOT EXISTS comentarios (
        id varchar PRIMARY KEY,
        id_usuario varchar NOT NULL,
        text varchar NOT NULL,
        postagem_id varchar NOT NULL,
        data_criacao DATE DEFAULT CURRENT_DATE,
        FOREIGN KEY (postagem_id) REFERENCES postagens(id)
    );
    `);

        await client.query(`
        CREATE OR REPLACE FUNCTION curtir_postagem(id_postagem varchar, token varchar)
        RETURNS INT AS $$
        DECLARE
            idUsuario varchar;
            qtd_likes INT;
            
        BEGIN
            SELECT id_usuario INTO idUsuario FROM postagens WHERE id = id_postagem;
            IF idUsuario IS NULL THEN
                RAISE EXCEPTION 'Postagem não existe';
            END IF;
            IF token IS NULL THEN
                RAISE EXCEPTION 'Token não existe';
            END IF;

            UPDATE postagens SET likes = likes + 1 WHERE id = id_postagem;
            SELECT likes INTO qtd_likes FROM postagens WHERE id = id_postagem;
            RETURN qtd_likes;
        END;
        $$ LANGUAGE plpgsql;
    `);

        await client.query(`
        DROP FUNCTION IF EXISTS LOGIN;
        CREATE OR REPLACE FUNCTION LOGIN(nome varchar, senha_usuario varchar)
        RETURNS TABLE (token_usuario varchar, id_usuario varchar) AS $$
        DECLARE
        token_usuario varchar;
        id_usuario varchar;
        BEGIN
            SELECT id INTO id_usuario FROM usuarios WHERE nome_de_usuario = nome AND senha = senha_usuario;
            SELECT token INTO token_usuario FROM usuarios WHERE id = id_usuario;
            IF id_usuario IS NULL OR token_usuario IS NULL THEN
                RAISE EXCEPTION 'Usuário ou senha incorretos';
            END IF;
            RETURN QUERY SELECT token_usuario, id_usuario;
        END;
        $$ LANGUAGE plpgsql;
    `);

        await client.query(`
        CREATE OR REPLACE FUNCTION INSERIR_USUARIO(id_usuario varchar, nome varchar, senha varchar, token varchar)
        RETURNS VOID AS $$
        BEGIN
            IF EXISTS (SELECT id FROM usuarios WHERE nome_de_usuario = nome) THEN
                RAISE EXCEPTION 'Usuário já existe';
            END IF;
            
            INSERT INTO usuarios (id, nome_de_usuario, senha, token) VALUES (id_usuario, nome, senha, token);
            RAISE NOTICE 'Usuário registrado com sucesso';
            
        END;
        $$ LANGUAGE plpgsql;
    `);

        console.log("Banco de dados conectado com sucesso!!")
    } catch (err) {
        if (err instanceof Error) {
            console.error(err);
        }
    }
})();

const confereTokenpostagem = async (token_usuario: string, id_postagem: string) => {
    const { id_usuario } = await client.query(`SELECT id_usuario FROM postagens WHERE id = '${id_postagem}'`)
    const { token } = await client.query(`SELECT token FROM usuarios WHERE id = '${id_usuario}'`)
    if (token === token_usuario) {
        return true
    }
    return false
}

const confereTokenComentario = async (token_usuario: string, id_comentario: string) => {
    const { id_usuario } = await client.query(`SELECT id_usuario FROM comentarios WHERE id = '${id_comentario}'`)
    const { token } = await client.query(`SELECT token FROM usuarios WHERE id = '${id_usuario}'`)
    if (token === token_usuario) {
        return true
    }
    return false
}

const confereTokenUsuario = async (token: string) => {
    const usuario = await client.query(`SELECT * FROM usuarios WHERE token = '${token}'`)
    if (usuario.rows.count === 0) {
        return false
    }
    return true
}

export async function insertUsuario(req: Request, res: Response) {
    try {
        const { nome_de_usuario, senha } = req.body
        const header_token = JSON.stringify({
            "alg": "HS256",
            "typ": "JWT"
        })

        const payload_token = JSON.stringify({
            "nome_de_usuario": nome_de_usuario,
            "senha": senha
        })

        const base64Header = Buffer.from(header_token).toString('base64').replace(/=/g, '');
        const base64Payload = Buffer.from(payload_token).toString('base64').replace(/=/g, '');

        const data = base64Header + "." + base64Payload;
        const signature = crypto.createHmac('sha256', data)
            .update('segredo')
            .digest('base64').replace(/=/g, '');

        const token = data + "." + signature;
        if (!validastring(nome_de_usuario) || !validastring(senha)) {
            throw new Error("Ops, nome de usuário ou senha inválidos");
        };
        const id = uuid();
        await client.query(`SELECT INSERIR_USUARIO('${id}','${nome_de_usuario}', '${senha}', '${token}')`)
            .then(() => {
                res.status(201).json({
                    "id": id, "token": token
                });
            })
            .catch((err) => {
                if (err instanceof Error) {
                    console.log(`Erro ao inserir usuario: ${err.message}`)
                    res.status(400).send(err.message);
                }
            })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao inserir usuario: ${err.message}`)
            res.status(400).send(err.message);
        }
    }
}

export async function retrieveUsuario(req: Request, res: Response) {
    try {
        const { nome_de_usuario } = req.params
        if (!validastring(nome_de_usuario)) {
            throw new Error("Ops, nome de usuário inválido ou não encontrado");
        }
        const usuario = await client.query(`SELECT * FROM usuarios WHERE nome_de_usuario = '${nome_de_usuario}'`)
        res.status(200).json({ "usuario": usuario.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar usuario: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function realizaLogin(req: Request, res: Response) {
    try {
        const { nome_de_usuario, senha } = req.body
        if (!validastring(nome_de_usuario) && !validastring(senha)) {
            throw new Error("Dados inválidos");
        }
        const retorno = await client.query(`SELECT * FROM LOGIN('${nome_de_usuario}', '${senha}')`)
        const { token_usuario, id_usuario } = retorno.rows[0]

        if (!token_usuario || !id_usuario) {
            throw new Error("Ops, token ou id não encontrado")
        }
        res.status(200).json({
            "id": id_usuario,
            "token": token_usuario
        })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar usuario: ${err.message}`)
            res.status(400).send(err.message);
        }
    }
}


export async function insertPostagem(req: Request, res: Response) {

    try {
        const { title, text, token } = req.body
        if ((!validastring(title) && !validastring(text)) || !validastring(token)) {
            throw new Error("Dados inválidos");
        }
        const id = uuid()
        const result = await client.query(`SELECT id FROM usuarios WHERE token = '${token}'`)
        if (result.rows.length === 0) {
            throw new Error("Usuário não encontrado")
        }
        const id_usuario = result.rows[0].id;
        await client.query(`INSERT INTO postagens VALUES ('${id}', '${id_usuario}','${title}', '${text}', 0, DEFAULT)`)
        res.status(201).json({ "id": id });
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao inserir postagem: ${err.message} `)
            res.sendStatus(400);
        }
    }
}


export async function retrievePostagem(req: Request, res: Response) {

    try {
        const { id } = req.params
        if (!validastring(id)) {
            throw new Error("Id inválido ou não informado")
        }
        const postagem = await client.query(`
            SELECT * FROM postagens WHERE id = '${id}'`)
        res.status(200).json({ "postagem": postagem.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar postagem: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function retrieveAllPostagens(req: Request, res: Response) {
    try {

        const postagens = await client.query(`
            SELECT * FROM postagens
            `)
        res.status(200).json({ "postagens": postagens.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar postagens: ${err.message} `)
            res.sendStatus(400);
        }
    }
}


export async function deletePostagem(req: Request, res: Response) {
    const { id } = req.params
    const { token } = req.body

    try {
        if (!validastring(id) || !validastring(token) || !confereTokenUsuario(token) || !confereTokenpostagem(token, id)) {
            throw new Error("Ops, id ou token inválidos ou inexistentes");
        }

        await client.query(`
        DELETE FROM postagens WHERE id = '${id}'`)
        res.sendStatus(204);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao deletar postagem: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function curtirPostagem(req: Request, res: Response) {
    try {
        const { id } = req.params
        const { token } = req.body

        if (!validastring(id) || !validastring(token) || !confereTokenUsuario(token)) {
            throw new Error("Ops, id ou token inválidos");
        }

        const retorno = await client.query(`
        SELECT CURTIR_POSTAGEM('${id}', '${token}')`)
        const { likes } = retorno.rows[0].likes
        console.log(retorno)
        res.status(200).json({ "likes": likes });

    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao curtir postagem: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function insertComentario(req: Request, res: Response) {
    try {
        const { id } = req.params
        const { text, token } = req.body

        if (!validastring(id) || !validastring(token) || !validastring(text)) {
            throw new Error("Dados inválidos");
        }
        if (!confereTokenUsuario(token)) {
            throw new Error("Token inválido");
        }

        const id_comentario = uuid()
        const id_usuario = await client.query(`SELECT id FROM usuarios WHERE token = '${token}'`)
        await client.query(`INSERT INTO comentarios VALUES ('${id_comentario}', '${id_usuario}', '${text}','${id}', DEFAULT)`)
        res.status(201).json({ "id": id_comentario });
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao inserir comentario: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function retrieveComentario(req: Request, res: Response) {

    try {
        const { id, id_comentario } = req.params
        if (!validastring(id) || !validastring(id_comentario)) {
            throw new Error("Dados inválidos");
        }

        const comentario = await client.query(`
            SELECT * FROM comentarios WHERE id = '${id_comentario}' and postagem_id = '${id}'`)
        res.json({ "comentario": comentario.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar comentario: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function retrieveAllComentariostoPostagem(req: Request, res: Response) {

    try {
        const { id } = req.params

        if (!validastring(id)) {
            throw new Error("O id da postagem é inválido");
        }
        const comentarios = await client.query(`
            SELECT * FROM comentarios WHERE postagem_id = '${id}'
        `)
        res.status(200).json({ "comentarios": comentarios.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar comentarios: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function deleteComentario(req: Request, res: Response) {
    try {
        const { id, id_comentario } = req.params
        const { token } = req.body
        if (!validastring(id_comentario) || !validastring(id) || !validastring(token) || !confereTokenUsuario(token)) {
            throw new Error("Dados inválidos");
        }
        if (!confereTokenComentario(token, id_comentario)) {
            throw new Error("Usuário não autorizado");
        }
        await client.query(`
        DELETE FROM comentarios WHERE id = '${id_comentario}' and postagem_id = '${id}'`)
        res.sendStatus(204);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao deletar comentario: ${err.message} `)
            res.sendStatus(400);
        }
    }
}
