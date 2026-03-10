# AI Agent-Based Location Discovery: Deep Dive

## Clarification: OpenClaw vs. Agent Frameworks

**OpenClaw is NOT suitable** for this use case. It's an AI coding agent designed for:
- Writing and editing code
- Terminal-based development workflows
- IDE integration

**What you need**: An autonomous agent framework that can:
- Execute web searches independently
- Browse websites and extract information
- Make decisions about data quality
- Run continuously without human intervention

---

## Agent Framework Options

### 1. **CrewAI** (Recommended for beginners)
```python
from crewai import Agent, Task, Crew
from crewai.tools import tool

@tool
def search_reddit(query: str) -> str:
    """Search Reddit for NYC location mentions"""
    # Implementation
    pass

researcher = Agent(
    role='Location Researcher',
    goal='Find hidden gem locations in NYC',
    tools=[search_reddit, search_google, browse_website],
    llm='gpt-4-turbo'
)

task = Task(
    description='Find 5 hidden gem cafes in Brooklyn',
    agent=researcher,
    expected_output='List of 5 cafes with names, addresses, and sources'
)

crew = Crew(agents=[researcher], tasks=[task])
result = crew.kickoff()
```

**Pros**: Simple API, good docs, role-based agents  
**Cons**: Less flexible for complex workflows

### 2. **LangChain + LangGraph** (Recommended for control)
```python
from langchain_openai import ChatOpenAI
from langchain.tools import Tool
from langgraph.graph import StateGraph

# Define state
tools = [
    Tool(name="search", func=search_web),
    Tool(name="browse", func=browse_page),
    Tool(name="validate", func=validate_location)
]

# Build graph
workflow = StateGraph(dict)
workflow.add_node("discover", discover_node)
workflow.add_node("validate", validate_node)
workflow.add_node("enrich", enrich_node)
workflow.set_entry_point("discover")
workflow.add_edge("discover", "validate")
workflow.add_edge("validate", "enrich")

# Compile and run
app = workflow.compile()
result = app.invoke({"query": "hidden gems NYC"})
```

**Pros**: Full control over workflow, state management  
**Cons**: Steeper learning curve, more code

### 3. **AutoGPT** (Experimental)
```bash
# Installation
pip install autogpt

# Configuration
# Set goals in .env:
# AI_NAME=LocationDiscoveryAgent
# AI_ROLE=Find hidden gems in NYC
# AI_GOALS=["Search Reddit for local favorites", "Validate locations on Google Maps", ...]
```

**Pros**: Fully autonomous, no coding required  
**Cons**: Unpredictable, can get stuck in loops, expensive

### 4. **Microsoft AutoGen**
```python
import autogen

config_list = [{"model": "gpt-4", "api_key": os.environ["OPENAI_API_KEY"]}]

assistant = autogen.AssistantAgent(
    name="researcher",
    llm_config={"config_list": config_list},
    system_message="You are a location researcher..."
)

user_proxy = autogen.UserProxyAgent(
    name="user_proxy",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=10,
    code_execution_config={"work_dir": "research_output"},
)

user_proxy.initiate_chat(
    assistant,
    message="Find 10 hidden gem restaurants in Queens NYC"
)
```

**Pros**: Multi-agent conversations, built-in code execution  
**Cons**: Complex setup

---

## Custom API Provider Support

### If Your Provider Isn't Listed

Most frameworks support custom endpoints via OpenAI-compatible API:

```python
# Example: Using a custom provider with LangChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="your-model-name",
    openai_api_base="https://your-provider.com/v1",
    openai_api_key="your-api-key",
    temperature=0.7
)
```

**Compatible frameworks** (support custom base URLs):
- LangChain ✅
- LiteLLM (universal proxy) ✅
- CrewAI (via LiteLLM) ✅
- AutoGen ✅

**What you need from your provider**:
- Base URL (e.g., `https://api.yourprovider.com/v1`)
- API key
- Model name
- OpenAI-compatible endpoints (`/chat/completions`, `/embeddings`)

### LiteLLM Proxy (Recommended for non-standard providers)
```python
# LiteLLM makes any LLM look like OpenAI
from litellm import completion

response = completion(
    model="custom/your-model",
    messages=[{"role": "user", "content": "Find hidden gems in NYC"}],
    api_base="https://your-provider.com/v1",
    api_key="your-key"
)
```

---

## Build vs. Buy: Do You Code From Scratch?

### Option A: Use Existing Framework (Build on top)
**What you build**:
- Agent definitions (roles, goals, constraints)
- Custom tools (Reddit search, Google Maps lookup)
- Data validation logic
- Database integration

**What the framework provides**:
- Agent loop (reasoning → action → observation)
- Tool calling infrastructure
- Memory/state management
- Error handling
- LLM streaming

**Effort**: 2-3 days to MVP

### Option B: Build From Scratch
**What you build**:
```python
class Agent:
    def __init__(self, llm, tools, system_prompt):
        self.llm = llm
        self.tools = tools
        self.memory = []
        
    def run(self, task):
        while not self.is_complete():
            # Get LLM response
            response = self.llm.chat(self.memory)
            
            # Parse tool calls
            if self.has_tool_call(response):
                tool_name, params = self.parse_tool_call(response)
                result = self.execute_tool(tool_name, params)
                self.memory.append({"role": "tool", "content": result})
            else:
                return response
```

**What you control**:
- Exact agent loop logic
- Tool execution flow
- Cost optimization
- Error recovery strategies

**Effort**: 1-2 weeks to MVP

**Recommendation**: Start with **CrewAI or LangChain** for your first version. Only build from scratch if you need extreme customization or cost optimization.

---

## Core Components You'll Need to Build

Regardless of framework choice, you'll need to implement:

### 1. **Tool Definitions**
```python
@tool
def search_reddit(subreddit: str, query: str) -> str:
    """Search Reddit for location mentions"""
    # PRAW integration
    
@tool  
def browse_atlas_obscura(city: str) -> str:
    """Scrape Atlas Obscura listings"""
    # BeautifulSoup scraping
    
@tool
def search_google(query: str) -> str:
    """Proxy search via SerpAPI"""
    # SerpAPI integration
    
@tool
def validate_location(name: str, address: str) -> dict:
    """Check Google Maps for coordinates, rating"""
    # Google Places API
```

### 2. **Agent Definitions**
```python
discovery_agent = Agent(
    role="Discovery Specialist",
    goal="Find raw location candidates from multiple sources",
    backstory="Expert at finding hidden spots through Reddit, local blogs...",
    tools=[search_reddit, browse_atlas_obscura, search_google],
    allow_delegation=False
)

validation_agent = Agent(
    role="Data Validator",
    goal="Verify location existence and quality",
    backstory="Meticulous fact-checker who ensures data accuracy",
    tools=[validate_location, check_chain_status],
    allow_delegation=False
)

enrichment_agent = Agent(
    role="Content Creator",
    goal="Generate compelling descriptions and vibe summaries",
    backstory="Creative writer who captures the essence of places",
    tools=[analyze_reviews, generate_description],
    allow_delegation=False
)
```

### 3. **Task Orchestration**
```python
discovery_task = Task(
    description="""
    Search Reddit r/AskNYC for mentions of "hidden gem" restaurants.
    Extract: name, neighborhood, brief description, source URL.
    Target: 20 candidates. Focus on gem_level 2 and 3.
    """,
    agent=discovery_agent,
    expected_output="JSON list of 20 location candidates"
)

validation_task = Task(
    description="""
    For each candidate, verify on Google Maps:
    - Confirm it exists
    - Get coordinates
    - Check review count (exclude if >500 for gem_level 3)
    - Confirm not a chain/franchise
    """,
    agent=validation_agent,
    context=[discovery_task],  # Uses previous output
    expected_output="JSON list of validated locations"
)

enrichment_task = Task(
    description="""
    For each validated location:
    - Write 2-3 sentence description
    - Generate ai_vibe_summary (max 20 words)
    - Create 6-12 tags
    - Assign gem_level based on review count and source quality
    """,
    agent=enrichment_agent,
    context=[validation_task],
    expected_output="JSON with full location data"
)
```

---

## LLM Streaming & Cost Management

### Streaming Responses
```python
# LangChain example
from langchain.callbacks import StreamingStdOutCallbackHandler

llm = ChatOpenAI(
    streaming=True,
    callbacks=[StreamingStdOutCallbackHandler()],
    model="gpt-4-turbo"
)

# Cost tracking
import tiktoken

def count_tokens(text: str, model: str = "gpt-4") -> int:
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))

total_cost = 0
for message in messages:
    tokens = count_tokens(message.content)
    cost = tokens * 0.00003  # $0.03 per 1K tokens for GPT-4
    total_cost += cost
```

### Cost Optimization Strategies
1. **Use GPT-3.5 for simple tasks** (discovery, validation)
2. **Use GPT-4 only for enrichment** (creative writing)
3. **Cache results** to avoid duplicate API calls
4. **Batch processing** - process multiple locations in one prompt

---

## Recommended Stack for Your Use Case

```
Framework: CrewAI (easiest) or LangChain (most control)
LLM: GPT-4 for enrichment, GPT-3.5-turbo for discovery/validation
Custom Provider: Via LiteLLM proxy if needed
Tools: 
  - PRAW (Reddit)
  - SerpAPI (Google search)
  - Google Places API (validation)
  - BeautifulSoup (Atlas Obscura)
Database: SQLite (dev) → PostgreSQL (production)
Orchestration: Simple Python script → Prefect/Airflow (scale)
```

---

## Next Steps

1. **Choose framework**: I recommend **CrewAI** for rapid prototyping
2. **Test your provider**: Verify custom API works with LiteLLM
3. **Build one tool**: Start with Reddit search
4. **Create one agent**: Discovery agent first
5. **Iterate**: Add validation, then enrichment

Want me to create a working prototype using CrewAI with your specific requirements?