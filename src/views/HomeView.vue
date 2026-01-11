<template>
  <div class="home">
    <h1>Главная страница Horse Quiz</h1>
    <p>Добро пожаловать в викторину о лошадях!</p>
    <router-link to="/room" class="btn">
      Присоединиться к игре
    </router-link>
  </div>
</template>

<script>
export default {
  name: 'Home'
}
</script>

<style scoped>
.home {
  padding: 40px;
  text-align: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.btn {
  display: inline-block;
  margin-top: 20px;
  padding: 15px 30px;
  background: #3498db;
  color: white;
  text-decoration: none;
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(52, 152, 219, 0.3);
}
</style>