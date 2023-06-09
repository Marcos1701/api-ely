import { Request, Response } from 'express'

import { client } from './conf_bd_pg.js'
// import { v4 as uuid } from 'uuid'
import * as crypto from 'crypto'

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
        CREATE TABLE IF NOT EXISTS usuarios (
            id UUID not null PRIMARY KEY,
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
            id_usuario varchar;
            qtd_likes INT;
        BEGIN
            SELECT id_usuario INTO id_usuario FROM postagens WHERE id = id_postagem;
            IF id_usuario IS NULL THEN
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
        CREATE OR REPLACE FUNCTION EXCLUIR_POSTAGEM(id_postagem varchar, token varchar)
        RETURNS VOID AS $$
        DECLARE
            id_usuario varchar;
        BEGIN
            SELECT id_usuario INTO id_usuario FROM postagens WHERE id = id_postagem;
            IF id_usuario IS NULL THEN
                RAISE EXCEPTION 'Postagem não existe';
            END IF;
            IF token IS NULL THEN
                RAISE EXCEPTION 'Token não existe';
            END IF;

            IF id_usuario != (SELECT id_usuario FROM usuarios WHERE token = token) THEN
                RAISE EXCEPTION 'Usuário não tem permissão para excluir a postagem';
            ELSE
                DELETE FROM postagens WHERE id = id_postagem;
                RAISE NOTICE 'Postagem excluída com sucesso';
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    `);

        await client.query(`
        CREATE OR REPLACE FUNCTION EXCLUIR_COMENTARIO(id_comentario varchar, token varchar)
        RETURNS VOID AS $$
        DECLARE
            id_usuario varchar;
        BEGIN
            SELECT id_usuario INTO id_usuario FROM comentarios WHERE id = id_comentario;
            IF id_usuario IS NULL THEN
                RAISE EXCEPTION 'Comentário não existe';
            END IF;
            IF token IS NULL THEN
                RAISE EXCEPTION 'Token não existe';
            END IF;

            IF id_usuario != (SELECT id_usuario FROM usuarios WHERE token = token) THEN
                RAISE EXCEPTION 'Usuário não tem permissão para excluir o comentário';
            ELSE
                DELETE FROM comentarios WHERE id = id_comentario;
                RAISE NOTICE 'Comentário excluído com sucesso';
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    `);

        await client.query(`
        CREATE OR REPLACE FUNCTION INSERIR_COMENTARIO(id_postagem varchar, token varchar, text varchar)
        RETURNS VARCHAR AS $$
        DECLARE
            id_usuario varchar;
            id_comentario varchar;
        BEGIN

            SELECT id_usuario INTO id_usuario FROM usuarios WHERE usuarios.token = token;
            IF NOT EXISTS (SELECT * FROM postagens WHERE id = id_postagem) THEN
                RAISE EXCEPTION 'Postagem não existe';
            END IF;
            IF token IS NULL THEN
                RAISE EXCEPTION 'Token não existe';
            END IF;

            SELECT uuid_generate_v4() INTO id_comentario;

            INSERT INTO comentarios VALUES(id_comentario, id_usuario, text, id_postagem);
            RAISE NOTICE 'Comentário inserido com sucesso';
            RETURN id_comentario;
        END;
        $$ LANGUAGE plpgsql;
    `);

        await client.query(`
        CREATE OR REPLACE FUNCTION INSERIR_POSTAGEM(token varchar, title varchar, text varchar)
        RETURNS VARCHAR AS $$
        DECLARE
            id_usuario varchar;
            id_postagem VARCHAR;
        BEGIN
            SELECT id_usuario INTO id_usuario FROM usuarios WHERE usuarios.token = token;
            IF token IS NULL THEN
                RAISE EXCEPTION 'Token não existe';
            END IF;

            SELECT uuid_generate_v4() INTO id_postagem;
            INSERT INTO postagens VALUES(id_postagem, id_usuario, title, text, 0);

            RAISE NOTICE 'Postagem inserida com sucesso';
            RETURN id_postagem;
        END;
        $$ LANGUAGE plpgsql;
    `);

        await client.query(`
        CREATE OR REPLACE FUNCTION LOGIN(nome_usuario varchar, senha_usuario varchar)
        RETURNS VARCHAR AS $$
        DECLARE
            token varchar;
        BEGIN
            SELECT token INTO token FROM usuarios WHERE nome_de_usuario = nome_usuario AND usuarios.senha = senha_usuario;
            IF token IS NULL THEN
                RAISE EXCEPTION 'Usuário ou senha incorretos';
            END IF;
            RETURN token;
        END;
        $$ LANGUAGE plpgsql;
    `);

        await client.query(`
        CREATE OR REPLACE FUNCTION REGISTRAR(nome_usuario varchar, senha varchar, token varchar)
        RETURNS VOID AS $$
        DECLARE
            id_usuario varchar;
            token varchar;
        BEGIN
            SELECT id_usuario INTO id_usuario FROM usuarios WHERE usuarios.nome_de_usuario = nome_usuario;
            IF id_usuario IS NOT NULL THEN
                RAISE EXCEPTION 'Usuário já existe';
            END IF;

            SELECT uuid_generate_v4() INTO id_usuario;
            
            INSERT INTO usuarios VALUES(id_usuario, nome_usuario, senha, TOKEN);
            RAISE NOTICE 'Usuário registrado com sucesso';
            
        END;
        $$ LANGUAGE plpgsql;
    `);

        console.log("Banco de dados conectado com sucesso!!")
        // console.log("Tabelas criadas com sucesso!")
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao criar tabelas: ${err.message}`)
        }
    }
})();

export async function insertUsuario(req: Request, res: Response) {
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
        res.sendStatus(400);
    };
    await client.query(`SELECT REGISTRAR('${nome_de_usuario}', '${senha}', '${token}')`)
        .catch((err) => {
            if (err instanceof Error) {
                console.log(`Erro ao inserir usuario: ${err.message}`)
                res.status(400).send(err.message);
            }
        })

    res.status(201).json({ "token": token });
}

export async function retrieveUsuario(req: Request, res: Response) {
    const { id } = req.params
    if (!validastring(id)) {
        res.sendStatus(400);
    }
    try {
        const usuario = await client.query(`SELECT * FROM usuarios WHERE id = '${id}'`)
        res.status(200).json({ "usuario": usuario.rows })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar usuario: ${err.message}`)
            res.sendStatus(400);
        }
    }
}

export async function realizaLogin(req: Request, res: Response) {
    const { nome_de_usuario, senha } = req.body
    if (!validastring(nome_de_usuario) && !validastring(senha)) {
        res.sendStatus(400);
    }
    try {
        const token = await client.query(`SELECT LOGIN('${nome_de_usuario}', '${senha}')`).rows[0].login
        res.status(200).json({ "token": token })
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao buscar usuario: ${err.message}`)
            res.status(400).send(err.message);
        }
    }
}


export async function insertPostagem(req: Request, res: Response) {
    const { title, text, token } = req.body
    if ((!validastring(title) && !validastring(text)) || !validastring(token)) {
        res.status(400).send("Dados inválidos");
    }

    try {
        const id = await client.query(`SELECT INSERIR_POSTAGEM('${token}', '${title}', '${text}')`)
        res.status(201).json({ "id": id });
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao inserir postagem: ${err.message} `)
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

// export async function updatePostagem(req: Request, res: Response) {
//     const { id } = req.params
//     let { title, text, likes, token } = req.body
//     likes = parseInt(likes)
//     if (!validastring(text) && isNaN(likes) && validastring(title) || !validastring(id)) {
//         res.sendStatus(400);
//     }
//     try {
//         if (likes && title && text && !isNaN(likes)) {
//             await client.query(`
//             UPDATE postagens SET title = '${title}', text = '${text}', likes = ${likes} WHERE id = '${id}'`)

//         } else if (!isNaN(likes)) {
//             await client.query(`
//             UPDATE postagens SET text = '${text}', likes = ${likes} WHERE id = '${id}'`)
//         } else {
//             await client.query(`
//             UPDATE postagens SET text = '${text}' WHERE id = '${id}'`)
//         }
//         const novaPostagem = await client.query(`
//     SELECT * FROM postagens WHERE id = '${id}'`)
//         res.status(200).json({ "postagem": novaPostagem.rows });
//     } catch (err) {
//         if (err instanceof Error) {
//             console.log(`Erro ao atualizar postagem: ${err.message} `)
//             res.sendStatus(400);
//         }
//     }
// }

export async function deletePostagem(req: Request, res: Response) {
    const { id } = req.params
    const { token } = req.body

    if (!validastring(id) || !validastring(token)) {
        res.sendStatus(400);
    }
    try {
        await client.query(`
        SELECT DELETAR_POSTAGEM('${token}', '${id}')`)
        res.sendStatus(204);
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao deletar postagem: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function curtirPostagem(req: Request, res: Response) {
    const { id, token } = req.params

    if (!validastring(id) || !validastring(token)) {
        res.sendStatus(400);
    }
    try {
        const retorno = await client.query(`
        SELECT CURTIR_POSTAGEM('${token}', '${id}')`)
        const likes = retorno.rows[0].curtir_postagem
        res.status(200).json({ "likes": likes });

    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao curtir postagem: ${err.message} `)
            res.sendStatus(400);
        }
    }
}

export async function insertComentario(req: Request, res: Response) {
    const { id } = req.params
    const { text, token } = req.body

    if (!validastring(id) || !validastring(token) || !validastring(text)) {
        res.sendStatus(400);
    }
    try {
        const id_comentario = await client.query(`
        SELECT INSERIR_COMENTARIO('${token}', '${id}', '${text}')`)
        res.status(201).json({ "id": id_comentario });
    } catch (err) {
        if (err instanceof Error) {
            console.log(`Erro ao inserir comentario: ${err.message} `)
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
    const { id } = req.params
    if (!validastring(id)) {
        res.sendStatus(400);
    }

    try {
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

// export async function updateComentario(req: Request, res: Response) {
//     const { id, id_comentario } = req.params
//     const { text } = req.body
//     if (!text || !validastring(id_comentario) || !validastring(id)) {
//         res.sendStatus(400);
//     }
//     try {
//         await client.query(`
//         UPDATE comentarios SET text = '${text}' WHERE id = '${id_comentario}' and postagem_id = '${id}'`)

//         const novoComentario = await client.query(`
//     SELECT * FROM comentarios WHERE id = '${id_comentario}' and postagem_id = '${id}'`)
//         res.status(200).json({ "comentario": novoComentario.rows });
//     } catch (err) {
//         if (err instanceof Error) {
//             console.log(`Erro ao atualizar comentario: ${err.message} `)
//             res.sendStatus(400);
//         }
//     }
// }

export async function deleteComentario(req: Request, res: Response) {
    const { id, id_comentario } = req.params
    if (!validastring(id_comentario) || !validastring(id)) {
        res.sendStatus(400);
    }

    try {
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
