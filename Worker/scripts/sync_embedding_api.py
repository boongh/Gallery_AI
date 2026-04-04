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
    start = time.time()
    queries = body["texts_query"]
    print("Embedding text queries: ", queries)
    vectors = []
    for query in queries:
        vector = utils.u_embedder_model.embed_text(query)
        vectors.append(vector)
    end = time.time()
    elapsed = end - start
    
    return {
        "content": {
            "elapsed_time": elapsed,
            "vector": vectors,
        },
    }