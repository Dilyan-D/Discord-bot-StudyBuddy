using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenQA.Selenium;
using OpenQA.Selenium.Edge;
using OpenQA.Selenium.Interactions;
using OpenQA.Selenium.Remote;
using OpenQA.Selenium.Support.UI;
using SeleniumExtras.WaitHelpers;
using System;
using System.Diagnostics;
using System.Threading;

namespace UnitTestProject1
{
    [TestClass]
    public class UnitTest1
    {
        private IWebDriver driver;
        private IWindow window;

        private void init()
        {
            driver = new EdgeDriver("F:\\Projects\\University\\DIPLOMA\\Testing\\driver");

            window = driver.Manage().Window;
            window.Maximize();
            driver.Url = "https://discord.com/login";

            driver.FindElement(By.Name("email")).SendKeys("studybuddy@abv.bg");
            driver.FindElement(By.Name("password")).SendKeys("studybuddy123" + Keys.Enter);

            WebDriverWait wait = new WebDriverWait(driver, TimeSpan.FromSeconds(20));
            wait.Until(ExpectedConditions.ElementExists(By.ClassName("avatarWithText-1tTt2S")));

            driver.Url = "https://discord.com/channels/701671137175797840/1106299537905168504";
            wait.Until(ExpectedConditions.ElementExists(By.ClassName("iconVisibility-vptxma")));
        }

        [TestMethod]
        public void MaterialsSpeedTest()
        {
            init();
            WebDriverWait wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
            driver.FindElement(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div/div[3]/div[2]/main/form/div/div[1]/div/div[3]/div/div/div/span/span/span")).SendKeys("/");
            wait.Until(ExpectedConditions.ElementExists(By.Id("autocomplete-0"))).Click(); // команда /материали
            driver.FindElement(By.Id("autocomplete-0")).Click(); // предмет: география
            driver.FindElement(By.Id("autocomplete-0")).Click(); // клас: 5
            driver.FindElement(By.Id("autocomplete-1")).Click(); // вид: изображение

            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div/div[3]/div/main/form/div/div[2]/div/div[2]/div/div/div/span[7]/span/span"))).SendKeys(Keys.Enter);
            wait.Until(ExpectedConditions.ElementExists(By.ClassName("select-Zz0IcO"))).Click();
            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[3]/div/div[1]/div[1]/div"))).Click();

            long startTime = Environment.TickCount; // Начало на замерване
            wait.Until(ExpectedConditions.ElementExists(By.ClassName("grid-1aWVsE"))); // Паузира изпълнение, докато не се появи елемента
            long endTime = Environment.TickCount; // Край на замерване

            long totalTime = endTime - startTime; // Отнето време за отговор
            int targetTime = 2000; // Целево време за отговор (максимум)

            Console.WriteLine("Изпълнението отне " + (double)totalTime / 1000 + " сек.");
            Assert.IsTrue(totalTime <= targetTime);
        }

        [TestMethod]
        public void LessonsSpeedTest()
        {
            init();
            WebDriverWait wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
            driver.FindElement(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div/div[3]/div[2]/main/form/div/div[1]/div/div[3]/div/div/div/span/span/span")).SendKeys("/");
            wait.Until(ExpectedConditions.ElementExists(By.Id("autocomplete-3"))).Click(); // команда /уроци
            driver.FindElement(By.Id("autocomplete-0")).Click(); // предмет: география
            driver.FindElement(By.Id("autocomplete-0")).Click(); // клас: 5

            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div[2]/div[3]/div/main/form/div/div[2]/div/div[2]/div/div/div/span[5]/span/span"))).SendKeys(Keys.Enter);
            wait.Until(ExpectedConditions.ElementExists(By.ClassName("select-Zz0IcO"))).Click();
            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[3]/div/div[1]/div[1]/div"))).Click();

            long startTime = Environment.TickCount;
            wait.Until(ExpectedConditions.ElementExists(By.ClassName("grid-1aWVsE")));
            long endTime = Environment.TickCount;

            long totalTime = endTime - startTime; // Отнето време за отговор
            int targetTime = 2000; // Целево време за отговор (максимум)

            Console.WriteLine("Изпълнението отне " + (double)totalTime / 1000 + " сек.");
            Assert.IsTrue(totalTime <= targetTime);
        }

        [TestMethod]
        public void TestsSpeedTest()
        {
            init();
            WebDriverWait wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
            driver.FindElement(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div/div[3]/div[2]/main/form/div/div[1]/div/div[3]/div/div/div/span/span/span")).SendKeys("/");
            wait.Until(ExpectedConditions.ElementExists(By.Id("autocomplete-2"))).Click(); // команда /тестове
            driver.FindElement(By.Id("autocomplete-0")).Click(); // предмет: география
            driver.FindElement(By.Id("autocomplete-0")).Click(); // клас: 5

            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div[2]/div[3]/div/main/form/div/div[2]/div/div[2]/div/div/div/span[5]/span/span"))).SendKeys(Keys.Enter);
            wait.Until(ExpectedConditions.ElementExists(By.ClassName("select-Zz0IcO"))).Click();
            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[3]/div/div[1]/div[1]/div"))).Click();

            long startTime = Environment.TickCount;
            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div[2]/div[3]/div[2]/main/div[1]/div/div/ol/li[1]/div/div[3]/div/div[2]/div/div/div"))).Click(); // Клик в/у меню отговор
            wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[3]/div/div[1]/div[1]"))).Click();

            for (int i = 2; i <= 7; i++)
            {
                Thread.Sleep(1000);
                wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div[2]/div[3]/div[2]/main/div[1]/div/div/ol/li[1]/div/div[3]/div/div[1]/div/div/div"))).Click(); // Клик в/у меню въпрос
                wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[3]/div/div[1]/div[" + i + "]"))).Click();
                Thread.Sleep(1000);
                wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[1]/div/div[2]/div/div/div/div[2]/div[3]/div[2]/main/div[1]/div/div/ol/li[1]/div/div[3]/div/div[2]/div/div/div"))).Click(); // Клик в/у меню отговор
                wait.Until(ExpectedConditions.ElementExists(By.XPath("/html/body/div[1]/div[2]/div[1]/div[3]/div/div[1]/div[1]"))).Click();
            }
            long endTime = Environment.TickCount;

            long totalTime = endTime - startTime; // Отнето време за отговор
            int targetTime = 20000; // Целево време за отговор (максимум)

            Console.WriteLine("Изпълнението отне " + (double)totalTime / 1000 + " сек.");
            Assert.IsTrue(totalTime <= targetTime);
        }
    }


}