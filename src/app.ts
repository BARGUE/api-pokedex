import express from "express";
import cors from "cors";
import compression from "compression";
import { errorHandler } from "./lib/http";
import { pokemonRouter } from "./routes/pokemon";
import { catalogRouter } from "./routes/catalog";

export const app = express();

app.use(cors());
// gzip : la liste /pokemon passe de ~1,3 Mo à quelques centaines de Ko sur le réseau.
app.use(compression());
app.use(express.json());

app.use("/pokemon", pokemonRouter);
app.use(catalogRouter);

app.use(errorHandler);
