import Client from 'pg'
// const client = new Client.Client({

//     host: 'localhost',
//     port: 5432,
//     user: 'postgres',
//     password: 'postgres',
//     database: 'db_atv_fech_api1'
// });

const client = new Client.Client({
    host: 'containers-us-west-153.railway.app',
    port: 5614,
    user: 'postgres',
    password: 'hKxtoKX5KNwH5KJEqaTR',
    database: 'railway'
});

export { client }
