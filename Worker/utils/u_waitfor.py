import time;

def wait_for(tryer, name, timeout=5):

    for i in range(timeout):
        try:
            return tryer();
        except Exception as e:
            print(f"{name} failed: {e}. Retrying in 5 seconds");
            time.sleep(5);
            
    raise RuntimeError(f"{name} is not available after {timeout * 5} seconds");