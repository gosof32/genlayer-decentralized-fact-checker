import json
from pathlib import Path

import pytest

GENVM_VERSION = "v0.2.16"  # matches the contract header
CONTRACT = str(Path(__file__).resolve().parents[1] / "contract.py")

URL1 = "https://evidence.example.org/one"
URL2 = "https://evidence.example.org/two"

BTC_PAGE = (
    "Bitcoin - History. The domain name bitcoin.org was registered in August 2008. "
    "Bitcoin began to be used as a currency in 2009, when its implementation was released as open-source software."
)
OTHER_PAGE = "Ethereum is a decentralized blockchain with smart contract functionality."

CLAIM = "Bitcoin began to be used as a currency in 2009."
TRUE_QUOTE = "Bitcoin began to be used as a currency in 2009"


def llm(verdict, source=1, quote="", explanation="ok"):
    return json.dumps({"verdict": verdict, "source": source, "quote": quote, "explanation": explanation})


@pytest.fixture
def checker(direct_vm, direct_deploy):
    direct_vm.check_pickling = True
    return direct_deploy(CONTRACT, sdk_version=GENVM_VERSION)


def addr_hex(a):
    return a.as_hex.lower()
