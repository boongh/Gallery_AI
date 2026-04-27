from fastapi import FastAPI
import utils.u_embedder_model
import time


# --- FastAPI app ---
app = FastAPI()

# @app.post("/embed/text")
# def embed_text_endpoint(body: dict):
#     vector = embed_text(body["query"])
#     return {"vector": vector}

@app.get("/ping")
def ping():
    return {"pong"}

@app.post("/embed/text")
def embed_text_endpoint(body: dict):
    import traceback
    start = time.time()
    queries = body["texts_query"]
    print("Embedding text queries: ", queries, flush=True)
    vectors = []
    for query in queries:
        try:
            vector = utils.u_embedder_model.embed_text(query)
            vectors.append(vector)
        except Exception as e:
            print("embed_text failed:", e, flush=True)
            print(traceback.format_exc(), flush=True)
            raise
    end = time.time()
    elapsed = end - start

    return {
        "content": {
            "elapsed_time": elapsed,
            "vector": vectors,
        },
    }